# Rules Machine Lambda Service

Example of a Lambda service that uses the Rules Machine library.

To keep this example simple, rules are hard-coded in the [`/rules/app-rules.ts`](/rules/app-rules.ts) file.

## Usage

### Deployment

In order to deploy the example, you need to run the following command:

```bash
serverless deploy
```

After running deploy, you should see output similar to:

```bash
Deploying rules-machine-service to stage dev (us-east-1)

✔ Service deployed to stack rules-machine-service-dev (112s)

functions:
  rules: rules-machine-service-dev-rules (806 B)
```

### Invocation

After successful deployment, you can invoke the deployed function by using the following command:

```bash
serverless invoke --function rules
```

### Local development

You can invoke your function locally by using the following command:

```bash
serverless invoke local --function rules
```
