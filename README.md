# BoreD

```
bore (verb)
/bɔː/
```

> Make (a hole) in something with a tool or by digging.

BoreD is a secure, end-to-end encrypted, reverse tunnel daemon for Kubernetes API access. It's designed to use with [Lens](https://github.com/lensapp/lens).

## Features

- Secure tunnel from users desktop to Kubernetes APIs
- Impersonation based on IdP issued JWT tokens
- End-to-end encryption, BoreD daemon cannot see the traffic it tunnels


## Architecture

![architecture](./images/architecture.png)

See also [BoreD Agent](https://github.com/lensapp/bored-agent) repository.


## Encryption

### Transport Layer Encryption

Both client and agent use websockets to establish socket connection to BoreD daemon. This transport layer can be secured using Secure WebSockets (basically HTTPS).

### Tunnel Encryption

BoreD tunnel encryption is done in two phases. Tunneled data is being encrypted using symmetric encryption (AES-256-GCM). Key exhange is done using asymmetric encryption (RSA-4096) where BoreD agent has the private key and the public key is distributed to clients via BoreD daemon.
