# claw-mcu

这是一个在 Windows PC 上模拟 ESP32 / MCU 的 OpenClaw MQTT 终端工程。

它的目标只有一件事：

- 像 MCU 一样连接 MQTT Broker
- 向 OpenClaw 的 MQTT `inbound` topic 发消息
- 订阅 OpenClaw 的 MQTT `outbound` topic 收回复
- 在本地终端里直接和 OpenClaw 聊天

## 1. 适用架构

```text
Windows 模拟 MCU
   ↓ publish JSON
openclaw/inbound
   ↓
OpenClaw Gateway + MQTT Channel Plugin
   ↓
Agent
   ↓ publish JSON
openclaw/outbound
   ↓
Windows 模拟 MCU
```

## 2. OpenClaw 侧配置

先确保 OpenClaw 已经启用了 MQTT channel。

> 说明：社区资料里可能同时看到 `@turquoisebay/openclaw-mqtt` 和 `@turquoisebay/mqtt` 两个名字。
> 仓库最近版本已改成 `@turquoisebay/mqtt`，但 topic 和消息格式保持一致。

OpenClaw 配置示例：

```json5
{
  channels: {
    mqtt: {
      brokerUrl: "mqtt://localhost:1883",
      topics: {
        inbound: "openclaw/inbound",
        outbound: "openclaw/outbound"
      },
      qos: 1
    }
  }
}
```

然后重启 Gateway。

### 如果 OpenClaw / MQTT Broker 在局域网另一台 Linux 机器

你的 Linux 机器是 `triton@172.29.33.93`，其中：

- `triton@172.29.33.93` 是 SSH 登录写法
- MQTT 连接时只使用主机地址 `172.29.33.93`
- 所以 Broker 地址应写成：`mqtt://172.29.33.93:1883`

- Windows 上运行本工程时，`--broker-url` 不要再写 `mqtt://localhost:1883`
- 应改成 Linux 机器的地址：`mqtt://172.29.33.93:1883`
- OpenClaw 和 Windows 模拟器必须指向同一个 MQTT Broker

常见有两种情况：

1. **Broker 就跑在 OpenClaw 那台 Linux 上**
  - Windows 模拟器连接 `mqtt://172.29.33.93:1883`
  - Linux 上 OpenClaw 可以继续用 `mqtt://localhost:1883`
  - 但 Broker 必须监听局域网地址，而不只是 `127.0.0.1`

2. **Broker 跑在第三台机器上**
  - Windows 模拟器和 OpenClaw 都连接那台 Broker 的 IP

另外请确认：

- Linux 防火墙已放行 MQTT 端口，通常是 `1883`
- Broker 配置允许局域网客户端接入
- Windows 能 `ping` 到 Linux 机器 IP
- OpenClaw 与本工程使用完全一致的 `inbound` / `outbound` topic

### 这台 Linux 上的 OpenClaw 应该怎么配

下面假设：

- OpenClaw 运行在 `triton@172.29.33.93`
- MQTT Broker 也运行在这台 Linux 上
- Broker 端口是 `1883`
- topic 使用：`openclaw/inbound` 和 `openclaw/outbound`

#### 1. 安装 MQTT channel plugin

在 Linux 上安装插件：

```bash
openclaw plugins install @turquoisebay/mqtt
```

如果你的 OpenClaw 环境里看到的仍是旧名字，也可能是：

```bash
openclaw plugins install @turquoisebay/openclaw-mqtt
```

#### 2. 配置 `~/.openclaw/openclaw.json`

如果 Broker 和 OpenClaw 在同一台 Linux 上，建议这样配：

```json5
{
  channels: {
    mqtt: {
      enabled: true,
      brokerUrl: "mqtt://localhost:1883",
      topics: {
        inbound: "openclaw/inbound",
        outbound: "openclaw/outbound"
      },
      qos: 1
    }
  }
}
```

如果 Broker 需要账号密码：

```json5
{
  channels: {
    mqtt: {
      enabled: true,
      brokerUrl: "mqtt://localhost:1883",
      username: "your-mqtt-user",
      password: "your-mqtt-password",
      topics: {
        inbound: "openclaw/inbound",
        outbound: "openclaw/outbound"
      },
      qos: 1
    }
  }
}
```

#### 3. 重启 OpenClaw Gateway

```bash
openclaw gateway restart
```

#### 4. 保证 Broker 对局域网开放

因为 Windows 模拟器要从局域网访问 Linux 上的 Broker，所以 Broker 不能只监听 `127.0.0.1`。

例如你的 Windows 模拟器会连接：

```text
mqtt://172.29.33.93:1883
```

所以 Linux 侧还要确认：

- Broker 正在运行
- Broker 监听 `0.0.0.0:1883` 或 `172.29.33.93:1883`
- 防火墙已放行 `1883`

#### 5. 与 Windows 模拟器配套关系

- Linux 上 OpenClaw：`brokerUrl` 可写 `mqtt://localhost:1883`
- Windows 上本工程：连接 `mqtt://172.29.33.93:1883`
- 两边 topic 必须相同：
  - `openclaw/inbound`
  - `openclaw/outbound`

#### 6. 最小自检

如果 OpenClaw 配好后，Windows 端运行：

```powershell
.\start.ps1 -BrokerUrl mqtt://172.29.33.93:1883
```

然后输入一句话，例如：

```text
你好
```

能收到 OpenClaw 回复，就说明通路正常。

## 3. 本工程消息格式

### 发给 OpenClaw 的消息

推荐 JSON：

```json
{
  "senderId": "esp32-sim-01",
  "text": "你好，OpenClaw",
  "correlationId": "request-001"
}
```

说明：

- `senderId`：决定 OpenClaw 会话记忆，等价于“设备 ID”
- `text`：发给 Agent 的正文
- `correlationId`：请求级追踪 ID，OpenClaw 回复时会原样带回

### OpenClaw 返回的消息

```json
{
  "senderId": "openclaw",
  "text": "你好，我收到了",
  "kind": "final",
  "ts": 1700000000000,
  "correlationId": "request-001"
}
```

## 4. 安装

在项目根目录执行：

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

如果你想直接用默认参数运行，最简单：

```powershell
.\start.ps1 -BrokerUrl mqtt://localhost:1883
```

如果 OpenClaw 在局域网另一台 Linux 机器，例如 `172.29.33.93`：

```powershell
.\start.ps1 -BrokerUrl mqtt://172.29.33.93:1883
```

## 5. 运行

### 方式 A：直接运行模块

```powershell
.\.venv\Scripts\python.exe -m claw_mcu_sim --broker-url mqtt://localhost:1883 --sender-id esp32-sim-01
```

局域网 Linux 示例：

```powershell
.\.venv\Scripts\python.exe -m claw_mcu_sim --broker-url mqtt://172.29.33.93:1883 --sender-id esp32-sim-01
```

### 方式 B：PowerShell 启动脚本

```powershell
.\start.ps1 -BrokerUrl mqtt://localhost:1883 -SenderId esp32-sim-01
```

局域网 Linux 示例：

```powershell
.\start.ps1 -BrokerUrl mqtt://172.29.33.93:1883 -SenderId esp32-sim-01
```

### 常用参数

- `--broker-url`：MQTT Broker 地址，比如 `mqtt://localhost:1883`
- `--inbound-topic`：发给 OpenClaw 的 topic
- `--outbound-topic`：接收 OpenClaw 回复的 topic
- `--sender-id`：模拟设备 ID
- `--username` / `--password`：Broker 账号密码
- `--qos`：MQTT QoS，默认 `1`
- `--tls-insecure`：当 `mqtts://` 使用自签名证书时可临时关闭校验

## 6. 交互命令

启动后，直接输入文本即可发消息。

内置命令：

- `/help`
- `/status`
- `/topics`
- `/sender <new-id>`
- `/exit`

## 7. 环境变量

也支持环境变量：

- `MQTT_BROKER_URL`
- `MQTT_USERNAME`
- `MQTT_PASSWORD`
- `MQTT_CLIENT_ID`
- `OPENCLAW_INBOUND_TOPIC`
- `OPENCLAW_OUTBOUND_TOPIC`
- `OPENCLAW_SENDER_ID`
- `OPENCLAW_MQTT_QOS`
- `OPENCLAW_MQTT_KEEPALIVE`
- `OPENCLAW_MQTT_CONNECT_TIMEOUT`
- `OPENCLAW_MQTT_TLS_INSECURE`

## 8. 最小联调步骤

1. 启动 MQTT Broker
2. 配好 OpenClaw 的 MQTT channel
3. 启动本工程
4. 在终端输入：`你好`
5. 如果 OpenClaw 配置正常，就会在同一终端看到回复

## 9. 典型用途

这个工程适合：

- 在没有真实 ESP32 前，先验证 MQTT channel 通路
- 调试 `senderId` / topic / QoS / 鉴权
- 验证 OpenClaw 是否能把同一个 channel 的回复发回“设备端”
- 后续把 PC 逻辑平移到 ESP32 固件

## 10. 注意事项

- OpenClaw 的 MQTT channel 会按 `senderId` 维持会话
- 多个模拟设备请使用不同 `senderId`
- 共享 `outbound` topic 时，客户端最好依赖 `correlationId` 做请求匹配
- 能发到 `inbound` topic 的客户端，就等于能直接访问你的 OpenClaw Agent
