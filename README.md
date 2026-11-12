## Trojan Web Manager

This is a web based user management system for trojan server

The public Query page looks up expiration by username only, without a password.
Anyone who knows a username can view its expiration through `/api/expiration`
(`/expiration` when running the standalone server). Administrator sign-in and
user creation still require passwords. The Users list is the supported user
listing page; it displays a full-page table below the toolbar with infinite
scrolling and clickable users for editing. The Grid page has been removed.
![login capture](./captures/login.png?raw=true "login")
![query capture](./captures/query.png?raw=true "query")
![renew capture](./captures/renew.png?raw=true "renew")
![add user capture](./captures/adduser.png?raw=true "adduser")
![users capture](./captures/users.png?raw=true "users")
#### prerequisites
1. Trojan user table should be created already using following sql
```
        CREATE TABLE users (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        username VARCHAR(64) NOT NULL,
        password CHAR(56) NOT NULL,
        quota BIGINT NOT NULL DEFAULT 0,
        download BIGINT UNSIGNED NOT NULL DEFAULT 0,
        upload BIGINT UNSIGNED NOT NULL DEFAULT 0,
        PRIMARY KEY (id),
        INDEX (password)
        );
```
2. Add a column named version and add a column named delta to trojan user table for optimistic locking
        ```ALTER TABLE users ADD COLUMN version INT(11) DEFAULT 0;```
        ```ALTER TABLE users ADD COLUMN delta INT(11) DEFAULT 0;```
3. Nginx should be installed
#### Backend installation
```pnpm i -g @darren-z-m-lin/trojan-web-manager-server```

## Deploy frontend and backend together on Google Cloud Run

The root `Dockerfile` builds the React client and Node server into one image.
The server serves the client at `/`, supports client-side route refreshes, and
exposes the API at `/api`. No separate frontend service or Nginx is needed.
Cloud Run terminates HTTPS; the container listens on `0.0.0.0:$PORT`.
The original unprefixed API remains the default when running outside this image.

From the repository root, with the Google Cloud CLI installed and authenticated:

```sh
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
```

Create Secret Manager secrets named `twm-admin-password` and `twm-db-password`
containing your administrator and MySQL passwords. Grant the Cloud Run runtime
service account `roles/secretmanager.secretAccessor` on those secrets, and ensure
the deploying account can act as that service account and build/deploy services.
Use a MySQL database with the existing Trojan schema and subscription columns;
the application does not create or migrate database tables.

For Cloud SQL for MySQL, also grant the runtime service account
`roles/cloudsql.client`, then deploy:

```sh
gcloud run deploy trojan-web-manager \
  --source . \
  --region YOUR_REGION \
  --service-account YOUR_RUNTIME_SERVICE_ACCOUNT \
  --allow-unauthenticated \
  --max-instances 1 \
  --add-cloudsql-instances YOUR_PROJECT_ID:YOUR_REGION:YOUR_SQL_INSTANCE \
  --set-env-vars DATABASE=trojan,USERNAME=YOUR_DB_USER,ADMIN=YOUR_ADMIN_USER,DB_SOCKET_PATH=/cloudsql/YOUR_PROJECT_ID:YOUR_REGION:YOUR_SQL_INSTANCE \
  --set-secrets ADMIN_PASSWORD=twm-admin-password:latest,PASSWORD=twm-db-password:latest
```

Open the resulting service URL to use the client. `--allow-unauthenticated`
allows access to the login page; application administrator authentication still
applies to protected API routes, including `/api/extendById`, which now requires
the same administrator cookie as the other subscription mutation endpoints.

Open `/docs` on the service URL to view the self-hosted Swagger UI. The
machine-readable specification is available at `/openapi.json`; its server URL
automatically matches the API prefix (`/api` in the container). Sign in through
the client or Swagger's `/signin` operation before trying administrator endpoints.
The browser sends the HTTP-only session cookie automatically; it cannot be
entered through Swagger's Authorize dialog. Documentation assets are bundled
in the container, and no external Swagger validator is used. The docs are public
unless access to the entire service is restricted with Cloud Run IAM.

For continuous deployment from GitHub, configure the Cloud Build trigger with
**Configuration: Cloud Build configuration file** and location `/cloudbuild.yaml`.
That file disables BuildKit provenance/SBOM attestations, which Cloud Run cannot
import as runnable images, then deploys the commit-tagged image to
`trojan-web-manager` in `asia-east1`. Override `_SERVICE` or `_REGION` in the
trigger if needed. The Cloud Build service account needs **Cloud Run Admin** and
**Service Account User** on the runtime service account. Existing Cloud Run
environment variables and secrets are preserved on each deploy.

For a different reachable MySQL server, omit `--add-cloudsql-instances` and
replace `DB_SOCKET_PATH` with `DB_HOST` and optionally `DB_PORT` (default `3306`).
Private-IP databases require Cloud Run VPC networking. `HOST` is the HTTP bind
address, not the database host. Never put passwords in the image or commit `.env`
files; both Docker and Cloud Build uploads exclude them.

Sessions and response caches are currently process-local. Keep the service at one
instance (as above); scale-to-zero, restarts, and deployments invalidate sessions.
Shared session storage is required before enabling multiple instances.

To try the same container locally, create an untracked environment file outside
the repository with `DATABASE`, `USERNAME`, `PASSWORD`, `ADMIN`,
`ADMIN_PASSWORD`, and `DB_HOST` pointing to a database reachable from the container:

```sh
docker build -t trojan-web-manager .
docker run --rm -p 8080:8080 --env-file /path/to/runtime.env trojan-web-manager
```

Then open `http://localhost:8080`. `API_PREFIX`, `CLIENT_DIST`, and `TRUST_PROXY`
are set by the image; locally, secure cookies are used only for HTTPS requests.

#### Frontend installation
```pnpm i -g @darren-z-m-lin/trojan-web-manager-client```

#### Backend Configuration

Copy `packages/server/.env.example` to an untracked `.env` file, or create one
with the following content:
```
HOST=0.0.0.0
PORT=8080
DB_HOST=203.0.113.10
DB_PORT=3306
DATABASE=trojan
USERNAME=username
PASSWORD=password
ADMIN=admin
ADMIN_PASSWORD=850702
LOG=false

```

Replace `203.0.113.10` with your external MySQL server's IP address or hostname.
`DB_HOST` defaults to `localhost` and `DB_PORT` defaults to `3306` when omitted.
`HOST` controls the HTTP listener, not the database connection. Leave
`DB_SOCKET_PATH` unset when connecting over TCP. The database must allow
connections from the application's network and the configured database user.
Load this file with `twManagerServer --env=/path/to/.env`, or pass it to the
container with `docker run --env-file /path/to/.env ...`.
Cloud Run does not automatically load your local `.env`; configure `DB_HOST`
and `DB_PORT` as service environment variables and passwords through Secret
Manager as described above.

#### Start frontend
``
nohup twManager > twm.log 2>&1 &
``
#### Start backend
``
nohup twManagerServer --env=/path/to/.env > twms.log 2>&1 &
``

#### Remove background jobs from current session
``
disown -a
``

#### Nginx reverse proxy config
```
server {
        listen       8000 default_server;
        listen       127.0.0.1:8000 default_server;
        server_name  127.0.0.1;
        root         /usr/share/nginx/html;
        #ssl_certificate /path/to/fullchain.pem; # REPLACE HERE
        #ssl_certificate_key /path/to/privkey.pem; # REPLACE HERE
        #ssl_session_cache shared:SSL:1m;
        #ssl_session_timeout  10m;
        #ssl_ciphers PROFILE=SYSTEM;
        #ssl_prefer_server_ciphers on;

        # Load configuration files for the default server block.
        include /etc/nginx/default.d/*.conf;


        location /api/ {
            proxy_pass http://127.0.0.1:8080/;
        }

        location / {
            rewrite ^(.*)$ / break;
            proxy_pass http://127.0.0.1:80;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }
        location /assets/ {
            proxy_pass http://127.0.0.1:80;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }


        error_page 404 /404.html;
            location = /40x.html {
        }

        error_page 500 502 503 504 /50x.html;
            location = /50x.html {
        }
    }

```

#### Open following url in the browser
```
http://127.0.0.1:8000
```
#### Login system using ADMIN and ADMIN_PASSWORD in .env

## How to start the project from the source

1. checkout the source code
```
git checkout ${project-url}
```
2. cd to the source code
```
cd /path/to/the/source/code
```
3. start the development environment
```
pnpm run dev
```
