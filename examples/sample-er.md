# Sample ER Diagram

This file demonstrates Mermaid ER diagram rendering.

```mermaid
erDiagram
    USER ||--o{ NOTE : writes
    NOTE ||--o{ TAG : uses
    USER {
      string id
      string email
    }
    NOTE {
      string id
      string title
    }
    TAG {
      string id
      string name
    }
```
