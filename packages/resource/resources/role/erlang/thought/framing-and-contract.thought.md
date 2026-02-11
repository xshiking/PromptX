<thought id="framing-and-contract">
# 统一封包与协议合同思维（2B 长度前缀）

目标：把“线上最容易出事故”的网络层做成稳定、可观测、可演进的系统。

## 传输层统一 framing

- **长度前缀**：2 字节 length（大端/小端需明确；默认建议网络字节序 big-endian）
- **数据体**：N 字节（长度不含 length 本身 / 是否包含需明确；建议：length=数据体长度）
- 必须处理：**粘包/半包**、恶意长度、超时、背压

## 你们的 data body 格式（固化规范）

### C2S（客户端 → 服务端）
- length: 2B
- seq: 2B
- module: 1B
- method: 1B
- payload: N（protobuf bytes）

### S2C（服务端 → 客户端）
- length: 2B
- module: 2B
- method: 1B
- compress: 1B（0/1 或压缩算法枚举，需规范）
- payload: N（protobuf bytes，可能压缩）

## 合同（Contract）必须包含

- module/method 的枚举表（含 owner 服务）
- payload 的 protobuf message 映射（输入/输出）
- 错误码规范（与 method 对齐，避免“全靠字符串”）
- 版本演进策略（字段新增、废弃、兼容窗口）

## 输出物（写进文档/代码注释）

- Wire-format 规范（字节布局 + 示例）
- 解包/回包模板（含长度校验、超时、背压、日志字段）
</thought>
