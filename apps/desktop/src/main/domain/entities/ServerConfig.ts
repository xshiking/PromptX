import { Result, ResultUtil } from '~/shared/Result'
import { ServerError } from '~/main/domain/errors/ServerErrors'

export interface ServerConfigData {
  port: number
  host: string
  workspace?: string
  autoStart?: boolean
  updateStrategy?: 'silent' | 'notify' | 'forced'
  debug?: boolean
  stateless?: boolean
  remoteMode?: boolean  // 远程模式：跳过本地路径验证，适用于跨机器场景
}

export class ServerConfig {
  private constructor(
    private readonly data: Required<ServerConfigData>
  ) {}

  static create(data: ServerConfigData): Result<ServerConfig, ServerError> {
    const errors: string[] = []

    if (!Number.isInteger(data.port) || data.port < 1 || data.port > 65535) {
      errors.push(`Invalid port: ${data.port}`)
    }

    if (!data.host || data.host.trim().length === 0) {
      errors.push('Host cannot be empty')
    }

    if (errors.length > 0) {
      return ResultUtil.fail(
        ServerError.configInvalid(errors.join(', '))
      )
    }

    const config = new ServerConfig({
      port: data.port,
      host: data.host.trim(),
      workspace: data.workspace || process.cwd(),
      autoStart: data.autoStart ?? false,
      updateStrategy: data.updateStrategy ?? 'notify',
      debug: data.debug ?? false,
      stateless: data.stateless ?? false,
      remoteMode: data.remoteMode ?? false
    })

    return ResultUtil.ok(config)
  }

  static default(): ServerConfig {
    return new ServerConfig({
      port: 5203,
      host: '127.0.0.1',
      workspace: process.cwd(),
      autoStart: false,
      updateStrategy: 'notify',
      debug: false,
      stateless: true,  // Changed to stateless mode for Claude Desktop compatibility
      remoteMode: false
    })
  }

  get port(): number {
    return this.data.port
  }

  get host(): string {
    return this.data.host
  }

  get workspace(): string {
    return this.data.workspace
  }

  get autoStart(): boolean {
    return this.data.autoStart
  }

  get updateStrategy(): 'silent' | 'notify' | 'forced' {
    return this.data.updateStrategy
  }

  get debug(): boolean {
    return this.data.debug
  }

  get stateless(): boolean {
    return this.data.stateless
  }

  get remoteMode(): boolean {
    return this.data.remoteMode
  }

  getAddress(): string {
    return `http://${this.host}:${this.port}`
  }

  withPort(port: number): Result<ServerConfig, ServerError> {
    return ServerConfig.create({ ...this.data, port })
  }

  withHost(host: string): Result<ServerConfig, ServerError> {
    return ServerConfig.create({ ...this.data, host })
  }

  toJSON(): ServerConfigData {
    return { ...this.data }
  }
}