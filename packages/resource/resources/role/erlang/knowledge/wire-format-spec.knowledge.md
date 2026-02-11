<knowledge id="wire-format-spec">
# 协议字节布局规范（2B length + C2S/S2C）

## Framing

- **length**：2B（建议网络字节序 big-endian）
- **frame**：`length(2B) + body(NB)`
- 建议约定：`length = body 的字节数`

## C2S（Client → Server）body

| 字段 | 长度 | 说明 |
|---|---:|---|
| seq | 2B | 序号/请求关联（幂等/重发定位） |
| module | 1B | 模块号 |
| method | 1B | 方法号 |
| payload | N | protobuf bytes |

## S2C（Server → Client）body

| 字段 | 长度 | 说明 |
|---|---:|---|
| module | 2B | 模块号（注意与 C2S 不同） |
| method | 1B | 方法号 |
| compress | 1B | 压缩标志/算法 |
| payload | N | protobuf bytes（可能压缩） |

## 必须明确的约定

- length 是否包含自身（建议：不包含）
- compress 的取值与算法（0=不压缩…）
- module/method 的枚举表与 message 映射表（单一真相源）
- 最大帧长度与超时（防攻击/防卡死）
</knowledge>
