export const stripHtml = (html = "") => {
  if (typeof html !== "string") return "";
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "") // 移除注释
    .replace(/<[^>]+>/g, " ") // 移除所有标签
    .replace(/\s+/g, " ") // 合并空白
    .trim();
};

// 截断到指定字数（保留句子完整性）
export const truncateToSentences = (text, maxChars = 600) => {
  if (text.length <= maxChars) return text;
  const truncated = text.substring(0, maxChars);
  const lastPeriod = truncated.lastIndexOf(".");
  const lastExclamation = truncated.lastIndexOf("!");
  const lastQuestion = truncated.lastIndexOf("?");
  const lastSentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion);
  if (lastSentenceEnd > maxChars * 0.7) {
    return truncated.substring(0, lastSentenceEnd + 1).trim();
  }
  return truncated.trim();
};
export const cleanJsonString = (str) => {
  // 移除 Markdown 代码块标记
  return str.replace(/```json\s*|\s*```/g, "").trim();
};
export const ensureArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    // 如果是逗号分隔字符串，尝试分割
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
};
