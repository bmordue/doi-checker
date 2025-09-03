# ADR-002: Code Quality Infrastructure

## Status
Accepted

## Context

The DOI Checker project lacked basic code quality infrastructure, which created several issues:

1. **Inconsistent code style**: No automated formatting or linting led to inconsistent code style
2. **Potential bugs**: No static analysis to catch common JavaScript issues
3. **Security vulnerabilities**: 13 npm security vulnerabilities in dependencies
4. **Developer experience**: No automated code quality checks in development workflow
5. **Maintainability**: Without consistent standards, code becomes harder to maintain over time

The project needed a comprehensive code quality infrastructure to ensure consistent, secure, and maintainable code.

## Decision

We will implement a complete code quality infrastructure consisting of:

### Linting Infrastructure (ESLint)
- **ESLint configuration**: Modern ESLint setup with recommended rules
- **Environment-specific configs**: Separate configs for source code and test files
- **Custom rules**: Project-specific rules for DOI Checker patterns
- **Integration**: npm scripts for linting and auto-fixing

### Code Formatting (Prettier)
- **Prettier configuration**: Consistent code formatting rules
- **Integration**: npm scripts for formatting and format checking
- **Compatibility**: ESLint and Prettier integration without conflicts

### Security Improvements
- **Dependency updates**: Fix non-breaking security vulnerabilities
- **Production vs dev**: Separate security concerns (dev vulnerabilities don't affect production)
- **Monitoring**: Regular security auditing as part of development process

### Quality Assurance Scripts
- **Combined checks**: Single command to run all quality checks (lint + format + test)
- **Pre-commit hooks**: Future integration point for automated quality gates
- **CI/CD ready**: Scripts designed for integration with automated pipelines

## Configuration Details

### ESLint Configuration (`eslint.config.js`)
```javascript
export default [
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { /* Cloudflare Worker globals */ }
    },
    rules: {
      "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
      "no-console": "off",
      "prefer-const": "error",
      "no-var": "error",
      "no-control-regex": "off"
    }
  }
  // Separate test configuration...
]
```

### Prettier Configuration (`.prettierrc`)
```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "endOfLine": "lf"
}
```

### npm Scripts
```json
{
  "lint": "eslint src/ tests/",
  "lint:fix": "eslint src/ tests/ --fix",
  "format": "prettier --write src/ tests/ *.js *.json *.md",
  "format:check": "prettier --check src/ tests/ *.js *.json *.md",
  "check": "npm run lint && npm run format:check && npm test"
}
```

## Consequences

### Positive
- **Improved code consistency**: Automated formatting ensures consistent style across the project
- **Reduced bugs**: ESLint catches common JavaScript issues before they become problems
- **Enhanced security**: Security vulnerabilities addressed, monitoring process established
- **Better developer experience**: Clear feedback on code quality issues with automated fixes
- **Team collaboration**: Consistent code style reduces friction in code reviews
- **Professional quality**: Code quality matches industry standards for production applications

### Negative
- **Initial setup cost**: Time invested in configuring and integrating tools
- **Learning curve**: Developers need to understand ESLint rules and Prettier formatting
- **Build process overhead**: Additional steps in development workflow
- **Tool dependencies**: Additional dev dependencies (ESLint, Prettier, etc.)

### Neutral
- **Configuration maintenance**: Periodic updates to linting rules and formatting preferences
- **Team consensus**: Need agreement on specific code style preferences
- **IDE integration**: Developers should configure their editors for optimal experience

## Implementation Notes

- Environment-specific globals handle Cloudflare Worker and test framework differences
- Control character regex rule disabled for legitimate sanitization use case
- Security vulnerabilities in production dependencies: 0 (dev-only vulnerabilities remain)
- All existing code passes linting and formatting checks after cleanup
- Integration ready for CI/CD pipelines and pre-commit hooks

## Future Considerations

- **Pre-commit hooks**: Consider adding husky and lint-staged for automatic quality gates
- **CI/CD integration**: Run quality checks in GitHub Actions or similar
- **Additional rules**: May add more project-specific ESLint rules as patterns emerge
- **Dependency updates**: Regular security audits and dependency updates