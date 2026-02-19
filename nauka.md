# Docker & PostgreSQL Commands

## Docker Compose

### Start containers

```bash
docker compose up        # foreground (logs visible)
docker compose up -d     # detached (background)
```

### Stop and remove containers

```bash
docker compose stop          # stop containers (keep data)
docker compose down          # remove containers + networks (keep volumes)
docker compose down -v       # remove containers + networks + volumes (wipes DB data)
docker compose down -v --rmi all  # remove everything including images
```

### Check running containers

```bash
docker ps                    # list running containers (shows name, ID, ports)
docker compose ps            # list containers for this compose project
```

### Verify env variables are loaded

```bash
docker compose config | grep POSTGRES   # shows resolved variable values
```

---

## PostgreSQL in Docker

### Create a database dump (backup)

**Option A: Using flags (local DB)**

```bash
docker exec -i <container-name> pg_dump -U <user> <database-name> > dump.sql
```

Example:

```bash
docker exec -i wykonczymy pg_dump -U postgres wykonczymy > dump.sql
```

| Part             | Meaning                                                      |
| ---------------- | ------------------------------------------------------------ |
| `docker exec -i` | Run a command inside a running container (`-i` = pass stdin) |
| `wykonczymy`     | Container name (from `container_name` in docker-compose.yml) |
| `pg_dump`        | PostgreSQL dump utility                                      |
| `-U postgres`    | Connect as user `postgres` (from `POSTGRES_USER` in .env)    |
| `wykonczymy`     | Database name (from `POSTGRES_DB` in .env)                   |
| `> dump.sql`     | Redirect output to a local file                              |

**Option B: Using a connection string (remote DB like Neon)**

```bash
docker exec -i <container-name> pg_dump "<connection-string>" > dump.sql
```

Example (dumping from Neon):

```bash
docker exec -i wykonczymy pg_dump "postgresql://user:password@host/dbname?sslmode=require" > dump.sql
```

The connection string replaces `-U`, `-h`, `-p`, and the database name — everything is in one URL.

| Part               | Meaning                                                             |
| ------------------ | ------------------------------------------------------------------- |
| `pg_dump "<url>"`  | Connection string contains user, password, host, port, and database |
| `?sslmode=require` | Required for remote databases (Neon, Supabase, etc.)                |

**Both options produce the same `dump.sql` file.** Use flags for local, connection string for remote.

**Option C: Using env variables from .env**

```bash
# Load .env into your shell first
source .env

# Then use the variables
docker exec -i wykonczymy pg_dump "$DB_POSTGRES_URL_PROD" > dump.sql
```

| Part                    | Meaning                                                       |
| ----------------------- | ------------------------------------------------------------- |
| `source .env`           | Loads all variables from .env into your current shell session |
| `$DB_POSTGRES_URL_PROD` | Shell expands this to the actual connection string value      |

**Common mistakes:**

```bash
# WRONG: missing $ — passes literal string "DB_POSTGRES_URL_PROD"
pg_dump "DB_POSTGRES_URL_PROD"

# CORRECT: $ tells the shell to expand the variable
pg_dump "$DB_POSTGRES_URL_PROD"

# WRONG: .env variables are NOT automatically in your shell
docker exec -i wykonczymy pg_dump "$DB_POSTGRES_URL_PROD"   # empty if not sourced

# CORRECT: source first, then use
source .env
docker exec -i wykonczymy pg_dump "$DB_POSTGRES_URL_PROD"   # works
```

**Note:** `source .env` only lasts for your current terminal session. Open a new terminal → need to `source` again.

### Restore a dump (import)

```bash
docker exec -i <container-name> psql -U <user> <database-name> < dump.sql
```

Example:

```bash
docker exec -i wykonczymy-db psql -U postgres wykonczymy < dump.sql
```

| Part         | Meaning                                        |
| ------------ | ---------------------------------------------- |
| `psql`       | PostgreSQL interactive terminal (executes SQL) |
| `< dump.sql` | Feed the file as input to psql                 |

### Connect to database interactively

```bash
docker exec -it wykonczymy-db psql -U postgres wykonczymy
```

| Flag | Meaning                                               |
| ---- | ----------------------------------------------------- |
| `-i` | Keep stdin open                                       |
| `-t` | Allocate a terminal (needed for interactive sessions) |

---

## Connection String

```
postgresql://user:password@host:port/database
```

Example from this project:

```
postgresql://postgres:postgres@localhost:5433/wykonczymy
```

| Part     | Value           | Source                                                  |
| -------- | --------------- | ------------------------------------------------------- |
| Protocol | `postgresql://` | Always the same for Postgres                            |
| User     | `postgres`      | `POSTGRES_USER` in .env                                 |
| Password | `postgres`      | `POSTGRES_PASSWORD` in .env                             |
| Host     | `localhost`     | Your machine (outside Docker)                           |
| Port     | `5433`          | Left side of `ports: '5433:5432'` in docker-compose.yml |
| Database | `wykonczymy`    | `POSTGRES_DB` in .env                                   |

**Inside Docker** (between services), use the service name and internal port:

```
postgresql://postgres:postgres@db:5432/wykonczymy
```

---

## Docker Compose Naming (3 different names)

| Name           | Where                     | Used for                                    | Example         |
| -------------- | ------------------------- | ------------------------------------------- | --------------- |
| Service name   | `services: db:` in YAML   | Internal Docker networking between services | `db:5432`       |
| Container name | `container_name:` in YAML | `docker exec`, `docker ps`                  | `wykonczymy-db` |
| Database name  | `POSTGRES_DB` in .env     | `psql -d`, connection strings               | `wykonczymy`    |
