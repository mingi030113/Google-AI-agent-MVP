import { badRequest } from "../../http.js";
import { answerAgentQuestion } from "../../agent-service.js";

export async function askAgentQuestionUseCase({ store, env, payload }) {
  if (!payload.question || payload.question.trim().length === 0) {
    throw badRequest("question is required.");
  }

  return answerAgentQuestion(payload, store, { env });
}
