## ADDED Requirements

### Requirement: Role-scoped knowledge index storage
The system SHALL maintain a role-scoped knowledge index that is independent from the cognition (memory) subsystem.

#### Scenario: Index database location is per role
- **WHEN** the system initializes the knowledge index for role `<roleId>`
- **THEN** it SHALL use a database located at `~/.promptx/knowledge/<roleId>/knowledge.db`

### Requirement: Indexing uses knowledge references from role definition
The system SHALL determine which knowledge sources to index by reading the role definition’s `<knowledge>` section and extracting `@knowledge://...` references.

#### Scenario: Extract knowledge sources from role document
- **WHEN** indexing starts for role `<roleId>`
- **THEN** the system SHALL load `@role://<roleId>` and extract all `@knowledge://...` references to form the indexing source list

### Requirement: Incremental reindexing by content hash
The system SHALL support incremental indexing such that unchanged knowledge sources are not reprocessed.

#### Scenario: Skip indexing for unchanged source
- **WHEN** indexing encounters a knowledge source whose computed content hash equals the stored hash
- **THEN** the system SHALL skip rebuilding chunks for that source

### Requirement: Rebuild chunks for changed sources atomically
When a knowledge source changes, the system SHALL replace all indexed chunks for that source in a single atomic operation.

#### Scenario: Replace chunks for a changed source
- **WHEN** indexing detects a knowledge source has changed content hash
- **THEN** it SHALL delete prior indexed chunks for that source and insert the new chunks within one database transaction

### Requirement: Markdown chunking preserves traceability
The system SHALL chunk knowledge Markdown into retrievable documents with traceability metadata.

#### Scenario: Each chunk includes provenance and title path
- **WHEN** a knowledge source is chunked
- **THEN** each indexed chunk SHALL include `source_path` (the knowledge resource id) and `title_path` (derived from Markdown headers)

### Requirement: Knowledge index does not modify cognition storage
Indexing knowledge SHALL NOT write to cognition storage (engrams/network) and SHALL NOT alter recall/remember behavior.

#### Scenario: Indexing is isolated from cognition
- **WHEN** knowledge indexing runs for any role
- **THEN** it SHALL NOT create, modify, or delete any files under `~/.promptx/cognition/<roleId>/`

