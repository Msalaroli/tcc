Steps:

- Create a certificate. You can use the following command: `openssl req -x509 -sha256 -days 365 -nodes -out cert.crt -keyout cert.key -subj "/CN=www.example.com"
openssl pkcs12 -export -out cert.pfx -inkey cert.key -in cert.crt`
- `npm install`
- `npm run start`
- Open <https://localhost:3000/stream.html> and choose the option to stream a screen, a window or a browser tab.
- Open <https://localhost:3000/> and enjoy!

To deploy on GitHub pages: `npm run deploy`
