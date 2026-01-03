
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { SRTBlock } from "../types";

/**
 * Helper function to wait for a specific duration
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Executes a function with exponential backoff retry logic
 */
async function callWithRetry<T>(fn: () => Promise<T>, maxRetries: number = 5): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const errorMsg = error?.message || "";
      const isRateLimit = errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED');
      
      // If the entity is not found, it might be an issue with the selected API key
      if (errorMsg.includes("Requested entity was not found")) {
        throw new Error("API_KEY_NOT_FOUND");
      }

      if (isRateLimit && attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 2000 + Math.random() * 1000;
        console.warn(`Rate limit hit. Retrying in ${Math.round(delay)}ms...`);
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export const rewriteSRTBlocks = async (
  targetBlocks: SRTBlock[],
  customPrompt: string,
  onBatchComplete: (blocks: SRTBlock[]) => void,
  onProgress: (progress: number) => void
): Promise<SRTBlock[]> => {
  // CRITICAL: Create a new GoogleGenAI instance right before making an API call 
  // to ensure it uses the most up-to-date API key from the dialog.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  
  const batchSize = 10;
  const totalBlocks = targetBlocks.length;
  const allResultBlocks: SRTBlock[] = [];

  for (let i = 0; i < totalBlocks; i += batchSize) {
    const currentBatch = targetBlocks.slice(i, i + batchSize);
    
    const prompt = `
      Bạn là một chuyên gia kể chuyện Minecraft (Minecraft Storyteller) chuyên nghiệp.
      NHIỆM VỤ: Viết lại toàn bộ nội dung phụ đề tiếng Anh sang tiếng Việt theo phong cách kể chuyện hành động.

      PHONG CÁCH CỐ ĐỊNH (STYLE TÓM):
      1. Góc nhìn: Ngôi thứ nhất, luôn xưng "tôi".
      2. Văn phong: Kể chuyện Minecraft (100 ngày, Hardcore), tập trung vào mạch diễn biến, hành động và quyết định.
      3. Cách viết: KHÔNG dịch sát nghĩa từng từ. Viết lại như đang kể lại một hành trình kịch tính.
      4. Ưu tiên: Mô tả hành động, cảm xúc và các tình huống cao trào trong game.
      5. Độ dài: Phải khớp với thời lượng (duration) của từng block. Không viết quá dài gây nhồi chữ, không quá ngắn gây hụt giọng AI.
      6. Ngôn ngữ: Tiếng Việt tự nhiên, gãy gọn, lôi cuốn.

      QUY TẮC BẮT BUỘC:
      - TUYỆT ĐỐI KHÔNG gộp dòng hoặc tách dòng.
      - TUYỆT ĐỐI KHÔNG thay đổi timestamp hoặc số thứ tự ID.
      - Giữ nguyên số lượng block đầu ra bằng chính xác số lượng block đầu vào.

      USER CUSTOM INSTRUCTIONS:
      "${customPrompt}"

      DỮ LIỆU ĐẦU VÀO (JSON):
      ${JSON.stringify(currentBatch.map(b => ({ id: b.index, text: b.content, duration: b.duration.toFixed(2) + 's' })))}

      YÊU CẦU ĐẦU RA: Trả về DUY NHẤT một mảng JSON chứa các chuỗi (strings) tiếng Việt tương ứng với từng ID theo đúng thứ tự.
    `;

    try {
      const response: GenerateContentResponse = await callWithRetry(() => 
        ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        })
      );

      const translatedTexts: string[] = JSON.parse(response.text || '[]');
      
      const processedBatch: SRTBlock[] = currentBatch.map((block, index) => ({
        ...block,
        content: translatedTexts[index] || block.content
      }));

      allResultBlocks.push(...processedBatch);
      onBatchComplete(processedBatch);
      onProgress(Math.min(100, Math.round(((i + currentBatch.length) / totalBlocks) * 100)));
      
      if (i + batchSize < totalBlocks) {
        await sleep(500);
      }
      
    } catch (error: any) {
      if (error.message === "API_KEY_NOT_FOUND") {
        throw error;
      }
      console.error("Batch processing error:", error);
      throw new Error(`Lỗi xử lý tại block ${i + 1}: ${error.message || error}`);
    }
  }

  return allResultBlocks;
};
