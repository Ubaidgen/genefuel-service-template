import { Module } from "@nestjs/common";
import { ExampleController } from "./example.controller.js";
import { InternalExampleController } from "./internal-example.controller.js";
import { ExampleRepository } from "./persistence/example.repository.js";
import { ArchiveExampleUseCase } from "./use-cases/archive-example.use-case.js";
import { CreateExampleUseCase } from "./use-cases/create-example.use-case.js";
import { GetExampleUseCase } from "./use-cases/get-example.use-case.js";
import { ListExamplesUseCase } from "./use-cases/list-examples.use-case.js";

@Module({
  controllers: [ExampleController, InternalExampleController],
  providers: [ExampleRepository, CreateExampleUseCase, ListExamplesUseCase, GetExampleUseCase, ArchiveExampleUseCase],
  // Export use-cases (not the repository) if another module needs them.
  exports: [GetExampleUseCase],
})
export class ExampleModule {}
