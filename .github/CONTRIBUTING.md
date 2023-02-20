# Contributing

Thank you for contributing to ts-macros! Your help is appreciated by the author of this library and everyone using it!

## Table of Contents

- [How can I contribute?](#how-can-i-contribute)
  - [Bug Reports](#bug-reports)
  - [Feature Requests](#feature-requests)
  - [Pull Requests](#pull-requests)
    - [Setup](#setup)
    - [Testing](#testing)
    - [Finishing up](#finishing-up)

## How can I contribute?

### Bug Reports

Before reporting a bug, plese [search for issues with similar keywords to yours](https://github.com/GoogleFeud/ts-macros/issues?q=is%3Aissue+is%3Aopen). If an issue already exists for the bug then you can "bump" it by commenting on it. If it doesn't, then you can create one.

When writing a bug report:

- Use a clear and descriptive title for the issue.
- Explain what you expected to see instead and why.

### Feature Requests

Suggestions are always welcome! Before writing a feature request, please [search for issues with similar keywords to yours](https://github.com/GoogleFeud/ts-macros/issues?q=is%3Aissue+is%3Aopen). If an issue already exists for the request then you can "bump" it by commenting on it. If it doesn't, then you can create one.

When writing a feature request:

- Use a clear and descriptive title for the issue.
- Provide examples of how the feature will be useful.

### Pull Requests

Want to go straight into writing code? To get some inspiration you can look through the issues with the `bug` tag and find one you think you can tackle. If you are implementing a feature, please make sure an issue already exists for it before directly making a PR. If it doesn't, feel free to create one!

All future changes are made in the `dev` branch, so make sure to work in that branch!

#### Setup

- Fork this repository
- Clone your fork
- Install all dependencies: `npm i`
- Build the project: `npm run build`
- Run the tests to see if everything is running smoothly: `npm test`

#### Testing

ts-macros has integrated and snapshot testing implemented. To make sure any changes you've made have not changed the transformer for worse, run `npm test`. This will first run all integrated tests, which test the **transpiled code**, and then ask you to continue with the snapshot testing.

During snapshot testing, ts-macros compares the **trusted** transpiled integrated tests with the ones on your machine that have just been transpiled in the previous step. If any changes have been detected, it will ask you if you approve of these changes. If you notice some of the generated code is wrong or not up to standards, disprove the changes, make your fixes and run `npm test` again until the latest transpiled code matches the trusted version, or until you're satisfied with the generated code.

#### Finishing up

Once you're done working on an issue, you can submit a pull request to have your changes merged! Before submitting the request, make sure there are no linting errors (`npm lint`), all tests pass (`npm test`), and your branch is up to date (`git pull`).
