# AWS Transcribe example using aws-sdk-js-v3 and Next.JS

Issue reproduction repository.

When using @aws-sdk/client-transcribe-streaming@3.2.0 with NextJS 10 (or previous version), transcribe client only work in development mode.

After building the application and running in production mode, we get the following error when attempting to start the transcribe command : `“Error: Expected SignatureV4 signer, please check the client constructor”`

I've manage to pinpoint the issue to the middleware-sdk-transcribe-streaming [configuration file](https://github.com/aws/aws-sdk-js-v3/blob/master/packages/middleware-sdk-transcribe-streaming/src/configuration.ts)

```javascript
// starting at line 34 to line 37

const validateSigner = (signer: any): signer is BaseSignatureV4 =>
  // We cannot use instanceof here. Because we might import the wrong SignatureV4
  // constructor here as multiple version of packages maybe installed here.
  (signer.constructor.toString() as string).indexOf("SignatureV4") >= 0;
```

The `validateSigner` expects the signer object's string representation to contain "SignatureV4".

Unfortunately, as we are using it in the front-end, the code is bundled and transformed to make the file size smaller. Removing the "SignatureV4" information.

## How to Reproduce

First, clone this repository, and install the dependencies using `yarn`.

You'll need an AWS account an IAM policy with authorization for Transcribe service.

### Working Scenario : Dev mode

To test the working version, run `yarn dev` and navigate to http://localhost:3000 (default port).

You'll be prompted to fill in the Access ID, Secret Key and your region. (Session Secret is optional and only en-US is set at the moment.)

Finally click on the `Start` button, allow microphones permissions and start speaking into your microphone. You should see the transcript displayed in the page.

If an error occur, you should be prompted with an `alert` message.

### Crashing Scenario : Production Mode

To test the issue, run `yarn build` then `yarn start` and navigate to http://localhost:3000 again.

Fill in the form again and after clicking on the `start` button and allowing microphone permissions, an `alert` message should appear: `“Error: Expected SignatureV4 signer, please check the client constructor”`
