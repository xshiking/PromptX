## ADDED Requirements

### Requirement: Auto-injection is user-transparent
The desktop host SHALL automatically retrieve and inject role knowledge for each user request without requiring explicit user actions.

#### Scenario: Knowledge is injected before sending the model request
- **WHEN** the user submits a new message while role `<roleId>` is active
- **THEN** the desktop host SHALL call `promptx_knowledge_search(roleId, userQuery, limit=k)` and inject the returned knowledge context before sending the request to the model

### Requirement: Injection uses a bounded context budget
The desktop host SHALL enforce a configurable upper bound on injected knowledge to avoid excessive prompt growth.

#### Scenario: Injection truncates or reduces results to meet budget
- **WHEN** the retrieved knowledge snippets exceed the configured injection budget
- **THEN** the desktop host SHALL reduce injected content (e.g., fewer results and/or shorter snippets) until the budget is met

### Requirement: Injection format is stable and explainable
Injected knowledge context SHALL use a stable format and SHALL include provenance for each included snippet.

#### Scenario: Injected block includes provenance for each snippet
- **WHEN** the desktop host injects knowledge context
- **THEN** it SHALL include `source_path` and `title_path` for each snippet in the injected block

### Requirement: Failure degrades gracefully
If knowledge search fails or returns no results, the desktop host SHALL proceed with the request without blocking the user.

#### Scenario: Tool failure does not block the request
- **WHEN** `promptx_knowledge_search` errors, times out, or returns zero results
- **THEN** the desktop host SHALL send the model request without knowledge injection

### Requirement: Injection is independent from cognition recall workflow
Auto-injection SHALL NOT require or trigger memory recall/remember flows and SHALL remain independent from cognition network state.

#### Scenario: Auto-injection does not call recall
- **WHEN** auto-injection runs for a user request
- **THEN** it SHALL NOT call `promptx_recall` and SHALL NOT depend on cognition network nodes

