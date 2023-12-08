---
sidebar_position: 0
---

# Introduction
The AVM processes public execution requests. A transaction may include multiple such requests ([`enqueuedPublicFunctionCalls`](../calls/enqueued-calls.md)) which the AVM will process separately. 

We define "Transaction Execution" as the VM's execution of every request in a transaction separately. "Request Execution" is the VM's complete execution of a single public execution request including all nested contract calls. Lastly, "Call Execution" is the VM's execution of a single contract call (an initial or nested call).

This document's explanation of the AVM will be separated into two main sections:
1. AVM Execution and State Model
1. AVM Circuit Implementation

While many of the design decisions for the AVM's execution and state model were driven by the necessity of an efficient circuit implementation, the "AVM Execution and State Model" section is meant to serve as a high-level VM specification that does not require an understanding of the underlying circuit implementation. That being said it may include some more technical notes in instances where decoupling proved difficult.

"AVM Execution and State Model" will cover "Request Execution" and "Call Execution", while "AVM Circuit Implementation" will focus only on "Call Execution" since the VM _circuit_ only processes individual public calls.
