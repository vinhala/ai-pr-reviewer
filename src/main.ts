import {
  getBooleanInput,
  getInput,
  getMultilineInput,
  setFailed,
  warning
} from '@actions/core'
import {Bot, BotOptions} from './bot'
import {ModelProvider, Options} from './options'
import {Prompts} from './prompts'
import {codeReview} from './review'
import {handleReviewComment} from './review-comment'

function deriveBotOptions(options: Options, mode: "summary" | "review"): BotOptions {
  switch (options.modelProvider) {
    case 'azure': {
      return {
        modelProvider: 'azure',
        azureOpenaiEndpoint: options.azureOpenaiEndpoint,
        azureOpenaiApiKey: options.azureOpenaiApiKey,
        azureOpenaiDeploymentName: options.azureOpenaiDeploymentName,
        debug: options.debug,
        language: options.language,
        systemMessage: options.systemMessage,
        timeoutMs: options.timeoutMS,
        retries: options.retries,
        responseTokens: mode === "summary" ? options.summaryTokens : options.reviewTokens
      }
    }
    case 'openai': {
      return {
        modelProvider: 'openai',
        openaiModel: options.openaiModel,
        openaiTemperature: options.openaiModelTemperature,
        openaiApiKey: options.azureOpenaiApiKey,
        responseTokens: mode === "summary" ? options.summaryTokens : options.reviewTokens,
        debug: options.debug,
        language: options.language,
        systemMessage: options.systemMessage,
        timeoutMs: options.timeoutMS,
        retries: options.retries
      }
    }
    default:
      throw new Error(`Unknown model provider: ${options.modelProvider}`)
  }
}

async function run(): Promise<void> {
  const options: Options = new Options(
    getBooleanInput('debug'),
    getBooleanInput('disable_review'),
    getBooleanInput('disable_release_notes'),
    getInput('max_files'),
    getBooleanInput('review_simple_changes'),
    getBooleanInput('review_comment_lgtm'),
    getMultilineInput('path_filters'),
    getInput('system_message'),
    getInput('model_provider') as ModelProvider,
    getInput('openai_model'),
    getInput('openai_model_temperature'),
    getInput('retries'),
    getInput('timeout_ms'),
    getInput('openai_concurrency_limit'),
    getInput('azure_openai_api_key'),
    getInput('azure_openai_endpoint'),
    getInput('azure_openai_deployment_name'),
    getInput('github_concurrency_limit'),
    getInput('summary_tokens'),
    getInput('review_tokens'),
    getInput('max_input_tokens'),
    getInput('language')
  )

  // print options
  options.print()

  const prompts: Prompts = new Prompts(
    getInput('summarize'),
    getInput('summarize_release_notes')
  )

  // Create two bots, one for summary and one for review

  let lightBot: Bot | null = null
  try {
    lightBot = new Bot(deriveBotOptions(options, "summary"))
  } catch (e: any) {
    warning(
      `Skipped: failed to create summary bot, please check your openai_api_key: ${e}, backtrace: ${e.stack}`
    )
    return
  }

  let heavyBot: Bot | null = null
  try {
    heavyBot = new Bot(deriveBotOptions(options, "review"))
  } catch (e: any) {
    warning(
      `Skipped: failed to create review bot, please check your openai_api_key: ${e}, backtrace: ${e.stack}`
    )
    return
  }

  try {
    // check if the event is pull_request
    if (
      process.env.GITHUB_EVENT_NAME === 'pull_request' ||
      process.env.GITHUB_EVENT_NAME === 'pull_request_target'
    ) {
      await codeReview(lightBot, heavyBot, options, prompts)
    } else if (
      process.env.GITHUB_EVENT_NAME === 'pull_request_review_comment'
    ) {
      await handleReviewComment(heavyBot, options, prompts)
    } else {
      warning('Skipped: this action only works on push events or pull_request')
    }
  } catch (e: any) {
    if (e instanceof Error) {
      setFailed(`Failed to run: ${e.message}, backtrace: ${e.stack}`)
    } else {
      setFailed(`Failed to run: ${e}, backtrace: ${e.stack}`)
    }
  }
}

process
  .on('unhandledRejection', (reason, p) => {
    warning(`Unhandled Rejection at Promise: ${reason}, promise is ${p}`)
  })
  .on('uncaughtException', (e: any) => {
    warning(`Uncaught Exception thrown: ${e}, backtrace: ${e.stack}`)
  })

await run()
