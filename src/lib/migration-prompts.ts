// Agent prompts are copied to the clipboard; they are never rendered as page content.

export const liorandbToMongodbPrompt = `# DATABASE MIGRATION AGENT

## Migrate LioranDB to MongoDB

You are a senior Node.js, TypeScript, MongoDB, and database migration engineer.

Your task is to **fully migrate this existing application from LioranDB to MongoDB**, preserving its functionality, database structure, application behavior, and existing data.

Do not merely provide instructions. Inspect the project, modify the code, validate the migration, and complete the implementation.

### STEP 1: Inspect the existing application

Before changing anything:

1. Identify the package manager (npm, pnpm, yarn, or Bun).
2. Read \`package.json\`, lockfiles, and TypeScript configuration.
3. Find every LioranDB import, connection, query, model, schema, and database operation.
4. Inspect environment variables and connection configuration.
5. Identify the application's framework and architecture.
6. Identify every database and collection currently used.
7. Identify indexes, validation rules, relationships, and transaction assumptions.
8. Inspect existing tests and deployment configuration.

Create an internal migration inventory before editing.

### STEP 2: Install the latest MongoDB driver

Check the npm registry for the latest stable, compatible MongoDB Node.js driver.

Install it using the project's existing package manager.

For npm:

\`\`\`
npm install mongodb@latest
\`\`\`

If the latest version is incompatible with the application's Node.js runtime, use the latest compatible stable version and document why.

Read the installed driver's actual TypeScript definitions and package documentation.

Inspect:

- \`node_modules/mongodb/\`
- Installed type declarations
- Relevant package documentation
- MongoDB connection APIs
- CRUD methods
- Cursor behavior
- BSON types
- Transactions and sessions
- Error classes

Do not assume API behavior from memory.

### STEP 3: Read the existing LioranDB driver documentation

Locate the installed LioranDB package in \`node_modules\`.

Inspect its documentation directory, whether named \`docs\`, \`documents\`, or another documented location.

Read the relevant files, including when available:

- \`README.md\`
- \`AGENTS.md\`
- \`agent.md\`
- \`info.md\`
- MongoDB migration guides
- API compatibility documentation
- Query documentation
- Schema/model documentation
- Authentication documentation
- Transport documentation
- Best practices
- Error handling documentation

Use the installed LioranDB driver implementation and documentation to understand the application's current behavior.

If documentation conflicts with implementation, investigate and document the discrepancy.

Do not invent unsupported APIs.

### STEP 4: Replace the database connection

Replace LioranDB initialization with MongoDB's official Node.js driver.

Use:

\`\`\`
import { MongoClient } from "mongodb";

const client = new MongoClient(
  process.env.MONGODB_URI!
);

await client.connect();

const db = client.db(
  process.env.MONGODB_DATABASE!
);
\`\`\`

Adapt this example to the application's existing architecture.

Requirements:

- Reuse MongoDB connections.
- Do not connect for every request.
- Support graceful shutdown.
- Use environment variables for credentials.
- Preserve TLS and authentication security.
- Do not expose secrets in logs.

### STEP 5: Convert every database operation

Find and replace all LioranDB-specific operations with verified MongoDB equivalents.

Cover:

- insertOne
- insertMany
- findOne
- find / findMany
- findManyByIds
- updateOne
- updateMany
- replaceOne
- deleteOne
- deleteMany
- countDocuments
- Aggregations
- Pagination
- Sorting
- Projections
- Index creation
- Collection management
- Database management
- Bulk operations

Handle MongoDB cursor semantics correctly.

Do not assume LioranDB and MongoDB return identical response shapes.

Preserve the application's public API and response contracts.

### STEP 6: Handle data types and schemas

Carefully inspect and convert:

- Document IDs
- ObjectId versus string IDs
- Dates
- Binary data
- Decimal values
- Nested objects
- Arrays
- Null and missing values
- Index definitions
- Unique constraints
- Validation rules
- Application-level relationships

Do not automatically convert string IDs into ObjectIds.

Preserve existing identifiers unless an explicitly verified conversion is required.

### STEP 7: Migrate existing data safely

If the application has existing LioranDB data, implement a safe migration procedure.

Requirements:

- Preserve all documents.
- Preserve IDs.
- Preserve collection names.
- Preserve supported data types.
- Recreate required indexes.
- Use bounded batches.
- Avoid loading the entire database into RAM.
- Support checkpoints and resume.
- Handle duplicate documents safely.
- Verify counts and representative document contents.
- Produce a migration report.

Never delete or overwrite production data without explicit authorization.

If database access or credentials are unavailable, complete the code migration and provide a runnable data-migration utility rather than pretending the data has been transferred.

Do not switch production traffic until data integrity and consistency have been verified.

### STEP 8: Preserve application architecture

Minimize changes to:

- Routes
- Controllers
- Services
- Business logic
- Authentication
- API response structures
- Frontend interfaces

Prefer modifying database adapters and repository implementations.

Do not rewrite unrelated application code.

### STEP 9: Validate everything

Run:

- TypeScript compilation
- Linting
- Unit tests
- Integration tests where available
- Build verification
- CRUD tests
- Connection tests
- Index validation
- Migration data-integrity checks

Fix all migration-related failures.

Do not remove the LioranDB dependency until all application references have been migrated and the build passes.

### STEP 10: Final report

Provide:

1. Files changed
2. Dependencies installed and removed
3. Database operations converted
4. Data migration status
5. Index and schema changes
6. Compatibility differences
7. Tests executed and results
8. Remaining manual steps
9. Rollback procedure

**FINAL OBJECTIVE: Convert the existing LioranDB application into a fully functional MongoDB application with minimal code changes, preserved behavior, and no silent data loss.**`;

export const mongodbToLiorandbPrompt = `# DATABASE MIGRATION AGENT

## Migrate MongoDB to LioranDB

You are a senior Node.js, TypeScript, MongoDB, and LioranDB integration engineer.

Your mission is to **fully migrate this existing application from MongoDB to LioranDB** using the official LioranDB Node.js/TypeScript driver.

The goal is minimal code changes, maximum compatibility, correct data handling, and production-ready integration.

Do not merely explain the migration. Inspect the application, install the driver, read its documentation, modify the source code, and validate the result.

### STEP 1: Analyze the existing application

Inspect:

- \`package.json\`
- Lockfiles
- TypeScript configuration
- MongoDB connection code
- MongoDB collections
- Mongoose schemas, if present
- Database queries
- CRUD operations
- Aggregation pipelines
- Indexes
- Transactions
- Sessions
- Error handling
- Environment variables
- Application architecture
- Existing tests

Identify all MongoDB-dependent code.

Create an internal inventory of methods and features that require migration.

### STEP 2: Install the latest LioranDB driver

First, inspect the LioranDB driver repository:

[https://github.com/LioranGroupOfficial/Liorandb-Rust](https://github.com/LioranGroupOfficial/Liorandb-Rust)

Driver source directory:

\`sdks/ldb-driver/ts-js\`

Determine the official published npm package name from the driver's \`package.json\` and documentation.

Do not guess the package name.

Check the npm registry for the latest stable published version.

Install that version using the application's existing package manager.

If the driver is not published or the registry is inaccessible, report the problem and use a supported installation method documented by the project.

Do not silently install an unverified package.

### STEP 3: READ THE INSTALLED DRIVER DOCUMENTATION BEFORE CODING

This step is mandatory.

Locate the installed LioranDB package inside:

\`node_modules/\`

Find its documentation folder.

The folder may be named:

- \`docs/\`
- \`documents/\`

Inspect the actual package contents rather than assuming a fixed directory structure.

Read all relevant documentation files, including when present:

- \`README.md\`
- \`AGENTS.md\`
- \`agent.md\`
- \`info.md\`
- Getting started
- Connection configuration
- Authentication
- gRPC transport
- CRUD
- Queries
- Aggregation
- Indexes
- Schemas and models
- Error handling
- Best practices
- MongoDB to LioranDB migration
- MongoDB compatibility matrix
- Framework integration guides

Also inspect the installed TypeScript declarations and public exports.

**Do not write any LioranDB integration code until you understand the actual installed driver API.**

If documentation is missing from the npm package, consult the matching published-version source or official repository documentation and disclose the version difference.

Never assume MongoDB APIs work identically in LioranDB.

### STEP 4: Configure LioranDB with gRPC priority

Use gRPC as the preferred transport for all supported database operations.

This includes:

- Single-document reads
- Single-document writes
- Batch reads
- Batch writes
- Updates
- Deletes
- Queries
- Aggregations
- Supported management operations

Never choose HTTP based on batch size.

Use explicit gRPC mode when the installed driver supports it.

Do not invent constructor options.

If the driver supports options equivalent to:

\`\`\`
{
  transport: "grpc"
}
\`\`\`

configure them using the verified API.

If the installed driver exposes different configuration names, follow its documentation.

Never silently retry a potentially committed write over HTTP.

Preserve TLS verification and authentication.

### STEP 5: Replace MongoDB initialization

Find existing code similar to:

\`\`\`
import { MongoClient } from "mongodb";

const client = new MongoClient(
  process.env.MONGODB_URI!
);

await client.connect();

const db = client.db("myapp");
\`\`\`

Replace it with the actual documented LioranDB driver initialization.

Use environment variables such as:

\`\`\`
LIORANDB_URI=
LIORANDB_DATABASE=
\`\`\`

Adapt variable names to existing application conventions.

Use a shared database client where appropriate.

Never create a new connection for every HTTP request.

Ensure clean connection shutdown.

### STEP 6: Convert all MongoDB CRUD operations

Convert every MongoDB database call to its verified LioranDB equivalent.

Cover:

- insertOne
- insertMany
- findOne
- find
- findMany
- findById equivalents
- updateOne
- updateMany
- replaceOne
- deleteOne
- deleteMany
- countDocuments
- Pagination
- Sorting
- Projection
- Aggregation
- Indexes
- Bulk operations

Use only methods supported by the installed driver and server.

Preserve the existing application's return types and API responses.

For MongoDB cursor-based operations, correctly adapt results to LioranDB's actual query API.

Do not invent cursor support.

### STEP 7: Migrate Mongoose applications correctly

If the application uses Mongoose:

1. Identify all schemas and models.
2. Identify validation rules.
3. Identify hooks and middleware.
4. Identify virtual properties.
5. Identify population and references.
6. Identify timestamps and defaults.
7. Identify unique constraints.
8. Identify plugins and transactions.

Read the LioranDB schema/model documentation.

Convert supported features using verified LioranDB APIs.

For unsupported features, implement explicit application-level equivalents only when semantics can be preserved.

Do not pretend that LioranDB directly supports Mongoose unless that compatibility has been tested.

### STEP 8: Handle MongoDB compatibility differences

Inspect:

- ObjectId
- BSON types
- Date serialization
- Decimal128
- Binary values
- Query operators
- Update operators
- Nested documents
- Arrays
- Unique indexes
- Compound indexes
- TTL behavior
- Aggregation operators
- Transactions
- Sessions
- Change streams

Use the driver's compatibility documentation.

If a feature is unsupported, do not silently ignore it.

Implement a safe adapter, clearly document the limitation, or flag it as a migration blocker.

Never replace an atomic operation with non-atomic behavior without explicit approval.

### STEP 9: Migrate existing MongoDB data

Build or use a safe migration utility.

Requirements:

- Read MongoDB in bounded batches.
- Write to LioranDB using supported gRPC operations.
- Preserve document IDs.
- Convert BSON values deliberately.
- Preserve collection names.
- Recreate supported indexes.
- Support checkpoint/resume.
- Handle duplicate documents.
- Record failures.
- Validate document counts.
- Verify document contents.
- Avoid unbounded memory consumption.
- Support graceful interruption.

Do not delete MongoDB data automatically.

Do not silently overwrite existing LioranDB data.

If credentials or live database access are unavailable, implement and validate the migration utility as far as possible and report what remains unexecuted.

For live systems, define a consistent cutover procedure. Do not claim zero-downtime migration without a verified change synchronization mechanism.

### STEP 10: Optimize LioranDB usage

Follow the installed driver's documented best practices.

Prioritize:

- Persistent gRPC connection reuse
- Bounded concurrency
- Safe batch sizes
- Query pagination
- Appropriate indexing
- Memory-aware workloads
- Backpressure handling
- Deadlines
- Authentication
- TLS
- Safe retries
- Connection lifecycle management
- Error classification

Do not hardcode performance guarantees or assume a specific server capacity.

### STEP 11: Preserve application behavior

Minimize modifications to:

- API routes
- Controllers
- Business logic
- Frontend contracts
- Authentication flows
- Response formats
- Existing application architecture

Prefer changing the data-access layer.

If the application lacks a database abstraction, introduce a small repository adapter only where it meaningfully reduces migration complexity.

### STEP 12: Validate the migration

Run:

- TypeScript type checking
- Linting
- Build
- Unit tests
- Integration tests where available
- Connection tests
- Insert tests
- Read tests
- Update tests
- Delete tests
- Query tests
- Index tests
- Data-integrity verification

Test single-document and batched operations over gRPC.

Verify that no unexpected HTTP fallback occurs.

Fix migration-related failures.

Only remove MongoDB or Mongoose dependencies after confirming that no application code requires them and that the migration has passed validation.

### STEP 13: Final migration report

Provide:

1. Installed LioranDB package and version
2. Documentation files studied
3. Files modified
4. MongoDB APIs replaced
5. LioranDB APIs used
6. Data migration status
7. Unsupported features
8. Compatibility adapters implemented
9. Tests executed and results
10. Remaining manual steps
11. Rollback instructions

**FINAL OBJECTIVE: Migrate this Node.js/TypeScript application from MongoDB to LioranDB using the latest compatible official driver, its installed documentation, and verified gRPC APIs, with minimal application changes and no silent data loss.**

**CRITICAL RULE: READ THE LIORANDB DRIVER DOCUMENTATION AND TYPE DECLARATIONS FIRST. NEVER GUESS ITS API.**`;
