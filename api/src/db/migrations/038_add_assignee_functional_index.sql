-- Add functional B-tree index for efficient assignee_id lookups on issues.
-- Replaces sequential scan + JSONB text comparison with index scan.
CREATE INDEX IF NOT EXISTS idx_documents_assignee
ON documents ((properties->>'assignee_id'))
WHERE document_type = 'issue';
