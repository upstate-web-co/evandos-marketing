export interface SeoOverride {
  title: string | null
  description: string | null
  og_image_r2_key: string | null
  schema_json: string | null
  noindex: number
}

export async function getSeoOverride(db: any, path: string): Promise<SeoOverride | null> {
  if (!db) return null

  try {
    const row = await db
      .prepare('SELECT title, description, og_image_r2_key, schema_json, noindex FROM seo_pages WHERE path = ?1')
      .bind(path)
      .first()

    return row as SeoOverride | null
  } catch {
    return null
  }
}
