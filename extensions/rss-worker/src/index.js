import Parser from "rss-parser";
import { buildUnifiedPrompt } from "./prompt.js";
import OpenAI from "openai";
import { truncateToSentences, stripHtml, cleanJsonString } from "./utils.js";
import { defineEndpoint } from "@directus/extensions-sdk";
/**
 * 清理 7 天前的旧日志和 90 天前的旧新闻
 */
async function performHousekeeping(services, schema) {
  const { ItemsService } = services;
  const logService = new ItemsService("cron_writer_logs", {
    schema,
    accountability: null,
  });
  const newsService = new ItemsService("tech_news", {
    schema,
    accountability: null,
  });

  const now = new Date();

  // 1. 清理日志 (保留 7 天)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const deletedLogs = await logService.deleteByQuery({
    filter: { date_created: { _lt: sevenDaysAgo.toISOString() } },
  });

  // 2. 清理旧新闻 (保留 90 天)
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const deletedNews = await newsService.deleteByQuery({
    filter: { date_created: { _lt: ninetyDaysAgo.toISOString() } },
  });

  return {
    logsRemoved: deletedLogs.length,
    newsRemoved: deletedNews.length,
  };
}
export default defineEndpoint((router, { services, getSchema }) => {
  const { ItemsService } = services;
  let isProcessing = false;

  router.post("/process", async (req, res) => {
    if (isProcessing)
      return res.status(429).json({ message: "Task is already running" });

    res.json({ message: "Processing started", status: "in-progress" });

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    (async () => {
      isProcessing = true;
      const schema = await getSchema();
      const logService = new ItemsService("cron_writer_logs", {
        schema,
        accountability: null,
      });

      // 初始化统计对象
      const stats = {
        total_sources: 0,
        total_selected: 0, // AI 认为相关的总数
        total_saved: 0, // 成功写入 DB 的总数
        sources_breakdown: [], // 每个源的明细
      };

      // 辅助日志函数
      const writeErrorLog = async (
        level,
        message,
        sourceName = "System",
        details = null
      ) => {
        try {
          await logService.createOne({
            level,
            message: message.substring(0, 255),
            source_name: sourceName.substring(0, 50),
            details: details
              ? typeof details === "string"
                ? details
                : JSON.stringify(details).substring(0, 255)
              : "",
            timestamp: new Date(),
          });
        } catch (e) {
          /* 忽略日志写入本身的错误 */
        }
      };

      try {
        const rssSourcesService = new ItemsService("rss_sources", {
          schema,
          accountability: null,
        });
        const analysisService = new ItemsService("tech_news", {
          schema,
          accountability: null,
        });

        const sources = await rssSourcesService.readByQuery({
          filter: { status: { _eq: "active" } },
          sort: ["-priority"],
        });

        const sourcesList = Array.isArray(sources)
          ? sources
          : sources?.data || [];
        stats.total_sources = sourcesList.length;

        if (stats.total_sources === 0) return;

        const genAI = new OpenAI({
          apiKey: process.env.LLM_API_KEY,
          baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        });

        for (const source of sourcesList) {
          let sourceSelected = 0;
          let sourceSaved = 0;

          try {
            const parser = new Parser({
              timeout: 10000,
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...",
                Accept:
                  "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                "Cache-Control": "no-cache",
                Pragma: "no-cache",
              },
            });
            const feed = await parser.parseURL(source.url);
            const items = (feed?.items || []).slice(0, source.fetch_limit || 3);

            for (const item of items) {
              const title = (item.title || "").replace(/<[^>]*>/g, "").trim();
              const rawContent = truncateToSentences(
                stripHtml(
                  item["content:encoded"] ||
                    item.content ||
                    item.description ||
                    ""
                ),
                800
              );

              if (!rawContent || rawContent.trim().split(/\s+/).length < 20)
                continue;

              try {
                const result = await genAI.chat.completions.create(
                  {
                    model: "qwen-plus",
                    max_completion_tokens: 1024,
                    messages: [
                      {
                        role: "user",
                        content: buildUnifiedPrompt(title, rawContent),
                      },
                    ],
                  },
                  { timeout: 40000 }
                );

                const llmResult = JSON.parse(
                  cleanJsonString(result.choices[0]?.message?.content || "{}")
                );
                await sleep(1500);

                if (llmResult?.is_relevant) {
                  sourceSelected++;
                  stats.total_selected++;

                  await analysisService.createOne({
                    title,
                    title_zh: llmResult.title_zh,
                    url: item.link || item.guid,
                    published_at: item.pubDate
                      ? new Date(item.pubDate).toISOString()
                      : new Date().toISOString(),
                    category: llmResult.category,
                    summary_zh: llmResult.summary_zh,
                    summary: llmResult.summary,
                    inspiration: llmResult.inspiration,
                    inspiration_zh: llmResult.inspiration_zh,
                  });
                  sourceSaved++;
                  stats.total_saved++;
                }
              } catch (e) {
                await writeErrorLog(
                  "warning",
                  `AI/DB Error: ${e.message}`,
                  source.name,
                  title
                );
              }
            }

            // 更新 RSS 源状态
            await rssSourcesService.updateOne(source.id, {
              last_fetched_at: new Date(),
              last_saved_items: sourceSaved,
              consecutive_fetches: source.consecutive_fetches || 0 + 1,
            });
          } catch (sourceErr) {
            await writeErrorLog(
              "error",
              `Fetch Failed: ${sourceErr.message}`,
              source.name,
              source.url
            );
          }

          // 记录该源的明细
          stats.sources_breakdown.push(
            `${source.name}: 选中 ${sourceSelected}, 写入 ${sourceSaved}`
          );
        }
        // 在任务最后记录汇总 Info 之前执行清理
        const { logsRemoved, newsRemoved } = await performHousekeeping(
          services,
          schema
        );
        await logService.createOne({
          level: "info",
          message: "Daily Task Completed Successfully",
          source_name: "TaskRunner",
          result: [
            `Total Sources: ${stats.total_sources}`,
            `Total Selected (AI): ${stats.total_selected}`,
            `Total Saved (DB): ${stats.total_saved}`,
            `Logs Cleaned: ${logsRemoved} (older than 7 days)`,
            `News Cleaned: ${newsRemoved} (older than 90 days)`,
            `--- Details ---`,
            ...stats.sources_breakdown,
          ].join("\n"),
          timestamp: new Date(),
        });
      } catch (fatalErr) {
        await writeErrorLog(
          "error",
          `Fatal: ${fatalErr.message}`,
          "System",
          fatalErr.stack
        );
      } finally {
        isProcessing = false;
      }
    })();
  });
});
