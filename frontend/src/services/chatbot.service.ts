import api from './api';
import type {
  ChatRequest,
  ChatResponse,
  SuggestionsResponse,
} from '../types/chatbot';

export const chatbotService = {
  /**
   * Send a message to the chatbot and get a response
   */
  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    const response = await api.post<ChatResponse>('/chatbot/message', request);
    return response.data;
  },

  /**
   * Get available command suggestions for the current user's role
   */
  async getSuggestions(): Promise<SuggestionsResponse> {
    const response = await api.get<SuggestionsResponse>('/chatbot/suggestions');
    return response.data;
  },
};

export default chatbotService;
