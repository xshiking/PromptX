## ADDED Requirements

### Requirement: Knowledge search returns top-K relevant chunks
The system SHALL provide a role-scoped knowledge search function that returns the top-K most relevant knowledge chunks for a given query.

#### Scenario: Search returns results ordered by relevance
- **WHEN** a caller searches knowledge for role `<roleId>` with query `<query>` and limit `<k>`
- **THEN** the system SHALL return at most `<k>` results ordered by relevance score (best matches first)

### Requirement: Search results include explainable provenance
Each search result SHALL include provenance fields sufficient for tracing back to the source document.

#### Scenario: Result includes provenance fields
- **WHEN** the system returns a knowledge search result
- **THEN** each result SHALL include `source_path` and `title_path`

### Requirement: Search results include injection-ready snippet
The system SHALL produce an injection-ready snippet for each result to support context injection within a bounded budget.

#### Scenario: Result includes snippet text
- **WHEN** the system returns search results
- **THEN** each result SHALL include a `snippet` field derived from the indexed content

### Requirement: Search is independent from memory network constraints
Knowledge search SHALL NOT require query terms to exist in the memory network and SHALL work regardless of cognition network state.

#### Scenario: Search works without cognition nodes
- **WHEN** the role’s cognition network is empty or unavailable
- **THEN** knowledge search SHALL still return results based solely on the knowledge index

### Requirement: CLI exposure for knowledge search
The system SHALL expose knowledge search via the Core CLI using a stable command identifier.

#### Scenario: Core CLI command exists
- **WHEN** a caller invokes the CLI command `knowledge.search` with `{ role, query, limit }`
- **THEN** the system SHALL execute a knowledge search and return the results in a consumable format

### Requirement: MCP exposure for knowledge search
The system SHALL expose knowledge search as an MCP tool for host-side automation and explicit model invocation.

#### Scenario: MCP tool promptx_knowledge_search exists
- **WHEN** a host calls the MCP tool `promptx_knowledge_search` with `{ role, query, limit }`
- **THEN** the tool SHALL return the same search results as `knowledge.search`, including provenance and snippets

