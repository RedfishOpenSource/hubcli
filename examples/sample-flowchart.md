# Sample Flowchart

This file demonstrates Mermaid flowchart rendering.

```mermaid
flowchart TD
    A[Start] --> B{Need Review?}
    B -->|Yes| C[Open Pull Request]
    B -->|No| D[Ship Changes]
    C --> D
```
