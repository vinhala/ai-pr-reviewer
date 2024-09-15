import { AzureOpenAI } from "openai";
import { LLM, LLMResponse, SendMessageOptions } from ".";

type Params = {
    baseURL: string;
    apiKey: string;
    deploymentName: string;
    systemMessage: string;
};

export class AzureOpenAILLM implements LLM {
  private client: AzureOpenAI;
  private deploymentName: string;
  private conversationHistory: Map<
    string,
    { role: "user" | "assistant" | "system"; content: string }[]
  > = new Map();
  private systemMessage: { role: "system"; content: string };

  constructor(args: Params) {
    this.client = new AzureOpenAI({
        baseURL: args.baseURL,
        apiKey: args.apiKey,
        deployment: args.deploymentName,
    });
    this.deploymentName = args.deploymentName;
    this.systemMessage = { role: "system", content: args.systemMessage };
  }

  async sendMessage(
    text: string,
    opts?: SendMessageOptions
  ): Promise<LLMResponse> {
    let messages: { role: "user" | "assistant" | "system"; content: string }[] = [
        this.systemMessage
    ];

    if (opts?.parentMessageId && this.conversationHistory.has(opts.parentMessageId)) {
      // Continue the conversation
      messages = [
        ...this.conversationHistory.get(opts.parentMessageId)!,
        { role: "user", content: text },
      ];
    } else {
      // Start a new conversation
      messages = [{ role: "user", content: text }];
    }

    const options: any = {};

    // Handle timeout
    let controller: AbortController | undefined;
    let timeout: NodeJS.Timeout | undefined;

    if (opts?.timeoutMs) {
      controller = new AbortController();
      timeout = setTimeout(() => {
        controller!.abort();
      }, opts.timeoutMs);
      options.abortSignal = controller.signal;
    }

    try {
      const result = await this.client.chat.completions.create(
        {
            model: this.deploymentName,
            messages: messages,
            stream: false,
        },
        options
      );

      if (timeout) {
        clearTimeout(timeout);
      }

      const responseText = result.choices[0].message.content!;
      const responseId = result.id;;

      // Save conversation history
      const newMessageId = responseId;
      this.conversationHistory.set(newMessageId, [
        ...messages,
        { role: "assistant", content: responseText },
      ]);

      return {
        text: responseText,
        id: newMessageId,
      };
    } catch (error) {
      if (timeout) {
        clearTimeout(timeout);
      }
      throw error;
    }
  }
}