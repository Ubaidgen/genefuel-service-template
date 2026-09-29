import { Global, Module } from "@nestjs/common";
import { FieldCrypto } from "./field-crypto.js";

@Global()
@Module({
  providers: [FieldCrypto],
  exports: [FieldCrypto],
})
export class SecurityModule {}
