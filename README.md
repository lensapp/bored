# BoreD

```
bore (verb)
/bɔː/
```

> Make (a hole) in something with a tool or by digging.

BoreD is a secure, end-to-end encrypted, reverse tunnel daemon for Kubernetes API access. It's designed to work with [Lens - The Kubernetes IDE](https://github.com/lensapp/lens). BoreD combines a client-side reverse proxy, websocket tunnels and end-to-end encryption to expose your Kubernetes API to users.

## Features

- Secure tunnel from users desktop to Kubernetes API
- Impersonation based on IdP issued JWT tokens
- Works behind firewalls / NAT
- End-to-end encryption, BoreD daemon cannot see the traffic it tunnels
- Link encryption using TLS for websockets (`wss://`)
- Automatic reconnects
- Handles multiple Kubernetes clusters


## Architecture

![architecture](./images/architecture.png)

- [BoreD](./README.md)
- [BoreD Agent](https://github.com/lensapp/bored-agent)


## JWT Tokens

### Client

```json
{
  "sub": "username",
  "groups": [],
  "clusterId": "cluster-uuid",
  "aud": "https://bored.domain.com/"
}
```

### Agent

```json
{
  "sub": "cluster-uuid",
  "aud": "https://bored.domain.com/"
}
```

## Encryption

### Transport Layer Encryption

Both client and agent use websockets to establish socket connection to BoreD daemon. This transport layer can be secured using Secure WebSockets (TLS).

### Tunnel Encryption

BoreD tunnel encryption is done in two phases. Tunneled data is being encrypted using symmetric encryption (AES-256-GCM). Key exhange is done using asymmetric encryption (RSA-4096) where BoreD agent has the private key and the public key is distributed to clients via BoreD daemon.
