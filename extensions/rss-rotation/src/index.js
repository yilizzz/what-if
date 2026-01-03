export default ({ schedule, action }, { database, logger }) => {
  const rotateLogic = async () => {
    try {
      logger.info("[Rotation] Starting rotation...");

      const current = await database("rss_sources")
        .where("status", "active")
        .first();

      const currentPriority = current ? current.priority : -1;

      let next = await database("rss_sources")
        .where("priority", ">", currentPriority)
        .orderBy("priority", "asc")
        .first();

      if (!next) {
        next = await database("rss_sources").orderBy("priority", "asc").first();
      }

      if (next) {
        await database.transaction(async (trx) => {
          if (current) {
            await trx("rss_sources")
              .where("id", current.id)
              .update({ status: "inactive" });
          }
          await trx("rss_sources")
            .where("id", next.id)
            .update({ status: "active" });
        });
      } else {
        logger.warn("[Rotation] No RSS sources found to rotate");
      }
    } catch (error) {
      logger.error(`[Rotation Error]: ${error.message}`);
    }
  };

  // 使用 Directus 的 schedule 功能
  // Cron 表达式：每天中午 12:00 执行
  schedule("0 12 * * *", async () => {
    logger.info("[Schedule] Triggering RSS rotation...");
    await rotateLogic();
  });
};
