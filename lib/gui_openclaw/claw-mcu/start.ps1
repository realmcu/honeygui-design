param(
    [string]$BrokerUrl = $env:MQTT_BROKER_URL,
    [string]$InboundTopic = $(if ($env:OPENCLAW_INBOUND_TOPIC) { $env:OPENCLAW_INBOUND_TOPIC } else { "openclaw/inbound" }),
    [string]$OutboundTopic = $(if ($env:OPENCLAW_OUTBOUND_TOPIC) { $env:OPENCLAW_OUTBOUND_TOPIC } else { "openclaw/outbound" }),
    [string]$SenderId = $(if ($env:OPENCLAW_SENDER_ID) { $env:OPENCLAW_SENDER_ID } else { "esp32-sim-01" }),
    [int]$Qos = $(if ($env:OPENCLAW_MQTT_QOS) { [int]$env:OPENCLAW_MQTT_QOS } else { 1 }),
    [switch]$TlsInsecure
)

if ([string]::IsNullOrWhiteSpace($BrokerUrl)) {
    $BrokerUrl = "mqtt://localhost:1883"
}

$python = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $python)) {
    throw "Python virtual environment not found: $python"
}

$args = @(
    "-m", "claw_mcu_sim",
    "--broker-url", $BrokerUrl,
    "--inbound-topic", $InboundTopic,
    "--outbound-topic", $OutboundTopic,
    "--sender-id", $SenderId,
    "--qos", $Qos
)

if ($env:MQTT_USERNAME) {
    $args += @("--username", $env:MQTT_USERNAME)
}
if ($env:MQTT_PASSWORD) {
    $args += @("--password", $env:MQTT_PASSWORD)
}
if ($TlsInsecure.IsPresent) {
    $args += "--tls-insecure"
}

& $python @args
