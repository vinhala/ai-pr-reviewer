import {info} from '@actions/core'
import {minimatch} from 'minimatch'

export type ModelProvider = 'azure' | 'openai'

export class Options {
  debug: boolean
  disableReview: boolean
  disableReleaseNotes: boolean
  maxFiles: number
  reviewSimpleChanges: boolean
  reviewCommentLGTM: boolean
  pathFilters: PathFilter
  systemMessage: string
  modelProvider: ModelProvider
  openaiModel: string
  openaiModelTemperature: number
  retries: number
  timeoutMS: number
  openaiConcurrencyLimit: number
  azureOpenaiApiKey: string
  azureOpenaiEndpoint: string
  azureOpenaiDeploymentName: string
  githubConcurrencyLimit: number
  summaryTokens: number
  reviewTokens: number
  maxInputTokens: number
  language: string

  constructor(
    debug: boolean,
    disableReview: boolean,
    disableReleaseNotes: boolean,
    maxFiles: string,
    reviewSimpleChanges: boolean,
    reviewCommentLGTM: boolean,
    pathFilters: string[] | null,
    systemMessage: string,
    modelProvider: string,
    openaiModel: string,
    openaiModelTemperature: string,
    retries: string,
    timeoutMS: string,
    openaiConcurrencyLimit: string,
    azureOpenaiApiKey: string,
    azureOpenaiEndpoint: string,
    azureOpenaiDeploymentName: string,
    githubConcurrencyLimit: string,
    summaryTokens: string,
    reviewTokens: string,
    maxInputTokens: string,
    language: string,
  ) {
    this.debug = debug
    this.disableReview = disableReview
    this.disableReleaseNotes = disableReleaseNotes
    this.maxFiles = parseInt(maxFiles)
    this.reviewSimpleChanges = reviewSimpleChanges
    this.reviewCommentLGTM = reviewCommentLGTM
    this.pathFilters = new PathFilter(pathFilters)
    this.systemMessage = systemMessage
    this.modelProvider = modelProvider as ModelProvider
    this.openaiModel = openaiModel
    this.openaiModelTemperature = parseFloat(openaiModelTemperature)
    this.retries = parseInt(retries)
    this.timeoutMS = parseInt(timeoutMS)
    this.openaiConcurrencyLimit = parseInt(openaiConcurrencyLimit)
    this.azureOpenaiApiKey = azureOpenaiApiKey
    this.azureOpenaiEndpoint = azureOpenaiEndpoint
    this.azureOpenaiDeploymentName = azureOpenaiDeploymentName
    this.githubConcurrencyLimit = parseInt(githubConcurrencyLimit)
    this.summaryTokens = parseInt(summaryTokens)
    this.reviewTokens = parseInt(reviewTokens)
    this.maxInputTokens = parseInt(maxInputTokens)
    this.language = language
  }

  // print all options using core.info
  print(): void {
    info(`debug: ${this.debug}`)
    info(`disable_review: ${this.disableReview}`)
    info(`disable_release_notes: ${this.disableReleaseNotes}`)
    info(`max_files: ${this.maxFiles}`)
    info(`review_simple_changes: ${this.reviewSimpleChanges}`)
    info(`review_comment_lgtm: ${this.reviewCommentLGTM}`)
    info(`path_filters: ${this.pathFilters}`)
    info(`system_message: ${this.systemMessage}`)
    info(`openai_model: ${this.openaiModel}`)
    info(`openai_model_temperature: ${this.openaiModelTemperature}`)
    info(`openai_retries: ${this.retries}`)
    info(`openai_timeout_ms: ${this.timeoutMS}`)
    info(`openai_concurrency_limit: ${this.openaiConcurrencyLimit}`)
    info(`azure_openai_api_key: ${this.azureOpenaiApiKey}`)
    info(`azure_openai_endpoint: ${this.azureOpenaiEndpoint}`)
    info(`azure_openai_deployment_name: ${this.azureOpenaiDeploymentName}`)
    info(`github_concurrency_limit: ${this.githubConcurrencyLimit}`)
    info(`summary_token_limits: ${this.summaryTokens}`)
    info(`review_token_limits: ${this.reviewTokens}`)
    info(`max_input_tokens: ${this.maxInputTokens}`)
    info(`language: ${this.language}`)
  }

  checkPath(path: string): boolean {
    const ok = this.pathFilters.check(path)
    info(`checking path: ${path} => ${ok}`)
    return ok
  }
}

export class PathFilter {
  private readonly rules: Array<[string /* rule */, boolean /* exclude */]>

  constructor(rules: string[] | null = null) {
    this.rules = []
    if (rules != null) {
      for (const rule of rules) {
        const trimmed = rule?.trim()
        if (trimmed) {
          if (trimmed.startsWith('!')) {
            this.rules.push([trimmed.substring(1).trim(), true])
          } else {
            this.rules.push([trimmed, false])
          }
        }
      }
    }
  }

  check(path: string): boolean {
    if (this.rules.length === 0) {
      return true
    }

    let included = false
    let excluded = false
    let inclusionRuleExists = false

    for (const [rule, exclude] of this.rules) {
      if (minimatch(path, rule)) {
        if (exclude) {
          excluded = true
        } else {
          included = true
        }
      }
      if (!exclude) {
        inclusionRuleExists = true
      }
    }

    return (!inclusionRuleExists || included) && !excluded
  }
}
