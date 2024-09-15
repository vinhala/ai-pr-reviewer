import { LLM } from '.';
import {
    ChatGPTAPI,
    // eslint-disable-next-line import/no-unresolved
} from 'chatgpt'

export type Params = {
    systemMessage: string
    apiKey: string
    apiOrg?: string
    maxResponseTokens: number
    completionParams: {
        temperature: number
        model: string
    }
}

export function makeOpenAILLM(args: Params): LLM {
    return new ChatGPTAPI({
        systemMessage: args.systemMessage,
        apiKey: args.apiKey,
        apiOrg: args.apiOrg,
        maxResponseTokens: args.maxResponseTokens,
        completionParams: args.completionParams
    })
}