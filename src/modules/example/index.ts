/**
 * Public API of the example module. Other modules import from here only —
 * never from domain/, use-cases/, persistence/ or integrations/
 * (enforced by `npm run lint:boundaries`).
 */
export { ExampleModule } from "./example.module.js";
export { exampleStatus, examples } from "./persistence/example.schema.js";
export type { Example, ExampleDto, ExampleStatus } from "./types.js";
export { GetExampleUseCase } from "./use-cases/get-example.use-case.js";
