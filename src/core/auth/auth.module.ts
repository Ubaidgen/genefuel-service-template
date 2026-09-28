import { Global, Module } from "@nestjs/common";
import { ServiceTokenVerifier } from "./service-token.js";
import { SessionVerifier } from "./session-verifier.js";

@Global()
@Module({
  providers: [SessionVerifier, ServiceTokenVerifier],
  exports: [SessionVerifier, ServiceTokenVerifier],
})
export class AuthModule {}
