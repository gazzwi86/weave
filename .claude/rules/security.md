## Security Rules

- Never hardcode API keys, tokens, or passwords in source files
- Always validate and sanitize user input at system boundaries
- Never use `eval()` or `Function()` constructors
- Do not log sensitive data (passwords, tokens, PII)
- Use parameterised queries — never concatenate user input into SQL/NoSQL queries
