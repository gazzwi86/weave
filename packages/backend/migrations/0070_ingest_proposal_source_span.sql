-- TASK-013 (constitution-engine, EPIC-012): per-proposal source-span locator.
--
-- Brief pitfall: "source_span locators must be persisted now (TASK-014
-- depends on them, retrofitting means re-extraction)". Nullable/additive --
-- TASK-012's NoOpExtractor and any non-document extractor never sets it.
ALTER TABLE ingest_proposals ADD COLUMN IF NOT EXISTS source_span TEXT;

-- TASK-012's ingest_jobs never needed to re-fetch the uploaded artefact
-- (NoOpExtractor only). TASK-013's DocumentExtractor is the first real
-- extractor and must re-fetch the S3 object to parse it -- persist the
-- corpus key + content type computed at upload time (upload_artefact_route
-- already derives both, just wasn't storing them). Nullable/additive.
ALTER TABLE ingest_jobs ADD COLUMN IF NOT EXISTS corpus_key TEXT;
ALTER TABLE ingest_jobs ADD COLUMN IF NOT EXISTS content_type TEXT;
