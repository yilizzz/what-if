export default ({ filter }, { services, getSchema }) => {
  const { ItemsService } = services;

  filter("items.update", async (payload, meta) => {
    if (meta.collection !== "rss_sources") {
      return payload;
    }
    if (payload.url === undefined) {
      return payload;
    }
    try {
      const schema = await getSchema();
      const itemsService = new ItemsService("rss_sources", { schema });
      const id = Array.isArray(meta.keys) ? meta.keys[0] : meta.keys;
      const original = await itemsService.readOne(id, { fields: ["url"] });

      if (original && original.url !== payload.url) {
        console.log("[✅ RESET TRIGGERED] URL changed! Resetting...");
        payload.consecutive_failures = 0;
        payload.last_fetch_error = null;
        payload.status = "active";
      } else {
        console.log(
          "[DEBUG] rss_sources : URLs are the same or no original record. No reset."
        );
      }
    } catch (error) {
      console.error(
        "[ERROR] Failed to read original record rss_sources:",
        error.message
      );
    }

    return payload;
  });
};
