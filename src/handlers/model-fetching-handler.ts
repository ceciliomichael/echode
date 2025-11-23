import * as vscode from 'vscode';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

interface ModelFetchRequest {
  requestId: number;
  provider: 'anthropic' | 'openai' | 'openai-compatible' | 'vscode-lm' | 'qwen-code';
  apiKey: string;
  baseURL: string;
}

/**
 * Handle model fetching requests from webview through backend SDKs
 */
export async function handleModelFetch(
  data: unknown,
  webview: vscode.WebviewView | vscode.WebviewPanel
): Promise<void> {
  const request = data as ModelFetchRequest;
  const { requestId, provider, apiKey, baseURL } = request;

  try {
    let models: string[] = [];

    // Route to appropriate provider
    if (provider === 'anthropic') {
      models = await fetchAnthropicModels(apiKey, baseURL);
    } else if (provider === 'openai' || provider === 'openai-compatible') {
      models = await fetchOpenAIModels(apiKey, baseURL, provider);
    } else if (provider === 'vscode-lm') {
      models = await fetchVSCodeLMModels();
    } else if (provider === 'qwen-code') {
      models = await fetchQwenCodeModels();
    } else {
      throw new Error(`Unknown provider: ${provider}`);
    }

    webview.webview.postMessage({
      type: 'modelsResponse',
      requestId,
      models
    });
  } catch (error) {
    webview.webview.postMessage({
      type: 'modelsError',
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Fetch models from Anthropic API and filter for Claude models
 */
async function fetchAnthropicModels(apiKey: string, baseURL: string): Promise<string[]> {
  const client = new Anthropic({
    apiKey,
    baseURL,
  });

  try {
    const response = await client.models.list();
    const allModels = response.data.map(m => m.id);
    
    // Filter for Claude models only
    return allModels.filter(modelId => 
      modelId.toLowerCase().startsWith('claude')
    );
  } catch (error) {
    throw new Error(`Anthropic API Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Fetch models from OpenAI or OpenAI-compatible API
 */
async function fetchOpenAIModels(
  apiKey: string,
  baseURL: string,
  provider: 'openai' | 'openai-compatible'
): Promise<string[]> {
  // Add /v1 to baseURL for OpenAI-compatible APIs
  const apiBaseURL = `${baseURL}/v1`;
  
  const client = new OpenAI({
    apiKey,
    baseURL: apiBaseURL,
  });

  try {
    const response = await client.models.list();
    const allModels = response.data.map(m => m.id);
    
    // Filter based on provider
    if (provider === 'openai') {
      // Filter for GPT models only
      return allModels.filter(modelId => 
        modelId.toLowerCase().startsWith('gpt')
      );
    } else {
      // OpenAI-compatible: return all models
      return allModels;
    }
  } catch (error) {
    throw new Error(`OpenAI API Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Fetch available models from VS Code Language Model API
 */
async function fetchVSCodeLMModels(): Promise<string[]> {
  try {
    // Fetch all available Copilot models
    const models = await vscode.lm.selectChatModels({
      vendor: 'copilot',
    });

    if (models.length === 0) {
      return [];
    }

    // Extract unique model families
    const modelFamilies = new Set<string>();
    for (const model of models) {
      if (model.family) {
        modelFamilies.add(model.family);
      }
    }

    // Return as array, sorted
    return Array.from(modelFamilies).sort();
  } catch (error) {
    throw new Error(`VS Code LM Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Fetch available Qwen Code models (static list)
 */
async function fetchQwenCodeModels(): Promise<string[]> {
  return ['qwen3-coder-plus', 'qwen3-coder-flash'];
}
