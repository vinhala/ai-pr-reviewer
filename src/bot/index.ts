import './fetch-polyfill'

import {info, setFailed, warning} from '@actions/core'
import pRetry from 'p-retry'
import { AzureOpenAILLM } from './azure'
import { makeOpenAILLM } from './openai'

export interface Ids {
  parentMessageId?: string
}

export interface LLM {
  sendMessage(text: string, opts?: SendMessageOptions): Promise<LLMResponse>;
}

export type SendMessageOptions = {
  timeoutMs?: number;
  parentMessageId?: string;
}

export type LLMResponse = {
  text: string;
  id: string;
}

function makeSystemMessage(options: BotOptions): string {
  const currentDate = new Date().toISOString().split('T')[0]
  return `${options.systemMessage} 
  Current date: ${currentDate}
  
  IMPORTANT: Entire response must be in the language with ISO code: ${options.language}
  `
}

type BotBaseOptions = {
  debug: boolean
  language: string
  systemMessage: string
  timeoutMs: number
  retries: number
  responseTokens: number
}

type AzureBotOptions = {
  modelProvider: "azure"
  azureOpenaiEndpoint: string
  azureOpenaiApiKey: string
  azureOpenaiDeploymentName: string
} & BotBaseOptions

type OpenAIBotOptions = {
  modelProvider: "openai"
  openaiModel: string
  openaiTemperature: number
  openaiApiKey: string
  openaiApiOrg?: string
} & BotBaseOptions

export type BotOptions = AzureBotOptions | OpenAIBotOptions

const isAzureBotOptions = (options: BotOptions): options is AzureBotOptions => options.modelProvider === "azure"

const isOpenAIBotOptions = (options: BotOptions): options is OpenAIBotOptions => options.modelProvider === "openai"

export class Bot {
  private readonly api: LLM

  private readonly options: BotOptions

  constructor(options: BotOptions) {
    this.options = options
    const systemMessage = makeSystemMessage(options)
    if (isAzureBotOptions(options)) {
      this.api = new AzureOpenAILLM({
        baseURL: options.azureOpenaiEndpoint,
        apiKey: options.azureOpenaiApiKey,
        deploymentName: options.azureOpenaiDeploymentName,
        systemMessage
      })
    } else if (isOpenAIBotOptions(options)) {
      this.api = makeOpenAILLM({
        systemMessage,
        apiKey: options.openaiApiKey,
        maxResponseTokens: options.responseTokens,
        completionParams: {
          temperature: options.openaiTemperature,
          model: options.openaiModel
        }
      })
    } else {
        const err =
        "Unable to initialize the OpenAI API, both 'OPENAI_API_KEY' environment variable are not available"
        throw new Error(err)
      }
  }

  chat = async (message: string, ids: Ids): Promise<[string, Ids]> => {
    let res: [string, Ids] = ['', {}]
    try {
      res = await this.chat_(message, ids)
      return res
    } catch (e: unknown) {
      warning(`chat failed: ${e}`)
      return res
    }
  }

  private readonly chat_ = async (
    message: string,
    ids: Ids
  ): Promise<[string, Ids]> => {
    // record timing
    const start = Date.now()
    if (!message) {
      return ['', {}]
    }

    let response: LLMResponse | undefined

    if (this.api != null) {
      const opts: SendMessageOptions = {
        timeoutMs: this.options.timeoutMs
      }
      if (ids.parentMessageId) {
        opts.parentMessageId = ids.parentMessageId
      }
      try {
        response = await pRetry(() => this.api!.sendMessage(message, opts), {
          retries: this.options.retries
        })
      } catch (e: unknown) {
        warning(`sendMessage failed: ${e}`)
      }
      const end = Date.now()
      info(`response: ${JSON.stringify(response)}`)
      info(
        `openai sendMessage (including retries) response time: ${
          end - start
        } ms`
      )
    } else {
      setFailed('The OpenAI API is not initialized')
    }
    let responseText = ''
    if (response != null) {
      responseText = response.text
    } else {
      warning('llm response is null')
    }
    // remove the prefix "with " in the response
    if (responseText.startsWith('with ')) {
      responseText = responseText.substring(5)
    }
    if (this.options.debug) {
      info(`llm responses: ${responseText}`)
    }
    const newIds: Ids = {
      parentMessageId: response?.id,
    }
    return [responseText, newIds]
  }
}
