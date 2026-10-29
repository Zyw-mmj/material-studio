#!/usr/bin/env bash
# macOS / Linux / WSL / Git Bash. Compose parses .env; never source or eval it.
set -euo pipefail

project_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)
cd -- "$project_dir"
mysql_only=false
compose_options=()
for option in "$@"; do
  if [[ "$option" == --mysql-only ]]; then
    mysql_only=true
  else
    compose_options+=("$option")
  fi
done
compose() {
  docker compose --project-directory "$project_dir" -f "$project_dir/compose.yaml" \
    "${compose_options[@]+"${compose_options[@]}"}" "$@"
}
fail() { printf '\n启动已停止：%s\n' "$1" >&2; exit 1; }
normalize_dir() {
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -am "$1"
  elif [[ -d "$1" ]]; then
    (cd -- "$1" && pwd -P)
  else
    printf '%s\n' "$1"
  fi
}
command -v docker >/dev/null 2>&1 || fail '请先安装 Docker，并启动 Docker Engine / Desktop。'
docker info >/dev/null 2>&1 || fail '无法连接 Docker，请先启动 Docker Engine / Desktop。'
compose config --quiet >/dev/null 2>&1 || fail '配置无效。首次运行请复制 .env.example 为 .env，并设置两个数据库密码；已有 .env 请保留。请检查 .env 语法和 Compose 选项。'

# Rendered interpolation values honor Compose --env-file, -p and shell precedence.
# Keep the output private, including credentials; do not echo the configuration.
configuration=$(compose config --environment 2>/dev/null) || fail '无法读取 Compose 配置，请检查 .env 语法及 Compose 版本。'
mysql_password= mysql_root_password= mysql_user=material_app mysql_database=material_platform
while IFS= read -r line; do
  case "$line" in
    MYSQL_PASSWORD=*) mysql_password=${line#*=} ;;
    MYSQL_ROOT_PASSWORD=*) mysql_root_password=${line#*=} ;;
    MYSQL_USER=*) value=${line#*=}; mysql_user=${value:-material_app} ;;
    MYSQL_DATABASE=*) value=${line#*=}; mysql_database=${value:-material_platform} ;;
  esac
done <<< "$configuration"
unset configuration
for key in MYSQL_PASSWORD MYSQL_ROOT_PASSWORD; do
  if [[ "$key" == MYSQL_PASSWORD ]]; then value=$mysql_password; else value=$mysql_root_password; fi
  case "$value" in
    ''|CHANGE_ME*) fail "$key 仍为空或使用示例值。请在当前 .env 中设置本地密码；已有数据库必须使用初始化时的密码。" ;;
  esac
done
unset value

# A copied checkout must not silently replace another directory's live stack.
container_ids=$(compose ps -a -q)
for id in $container_ids; do
  owner=$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' "$id")
  if [[ -n "$owner" && "$owner" != '<no value>' ]] && \
      [[ "$(normalize_dir "$owner")" != "$(normalize_dir "$project_dir")" ]]; then
    printf '现有容器属于目录：%s\n当前目录：%s\n' "$owner" "$project_dir" >&2
    fail '同名 Compose 项目已被另一目录使用。请回到原目录启动；独立副本须设置不同 COMPOSE_PROJECT_NAME、FRONTEND_PORT 和 MYSQL_PORT（见 README）。现有容器和卷未被修改。'
  fi
done

mysql_id=$(compose ps -a -q mysql)

probe() {
  # Send the existing password over stdin, not as a process argument or log entry.
  printf '%s\n' "$1" | docker exec -i "$mysql_id" sh -c \
    'IFS= read -r MYSQL_PWD; export MYSQL_PWD; exec mysql --protocol=TCP --connect-timeout=3 -h 127.0.0.1 --user="$1" --database="$2" --batch --skip-column-names -e "SELECT 1"' \
    sh "$2" "$3"
}
verify_login() {
  local password=$1 user=$2 database=$3 key=$4 attempt diagnostic
  for ((attempt = 0; attempt < 60; attempt++)); do
    if diagnostic=$(probe "$password" "$user" "$database" 2>&1); then
      return
    fi
    case "$diagnostic" in
      *'ERROR 1045'*|*'ERROR 1698'*)
        fail "$key 与现有数据库的账号/密码不匹配。修改 .env 不会重置旧数据卷中的密码；请恢复原连接配置，或用不同项目名和端口启动独立实例。已有数据卷保留，请勿用 down -v 解决此错误。" ;;
      *'ERROR 1049'*|*'ERROR 1044'*)
        fail '现有数据库的库名或用户权限与配置不一致。请恢复原 MYSQL_DATABASE / MYSQL_USER 配置；初始化变量不会修改旧数据库。数据卷已保留。' ;;
    esac
    sleep 2
  done
  fail 'MySQL 在等待期内未就绪。请执行 docker compose logs --tail=100 mysql 查看启动错误；若指定了 -p 或 --env-file，查看日志时也使用相同选项。数据卷已保留。'
}
verify_credentials() {
  verify_login "$mysql_password" "$mysql_user" "$mysql_database" MYSQL_PASSWORD
  verify_login "$mysql_root_password" root mysql MYSQL_ROOT_PASSWORD
}
verified=false
if [[ -n "$mysql_id" ]] && [[ "$(docker inspect --format '{{.State.Running}}' "$mysql_id")" == true ]]; then
  printf '配置检查通过，正在验证已有 MySQL 连接…\n'
  # Reject wrong credentials before recreating an already running database.
  verify_credentials
  verified=true
fi
printf '正在启动 MySQL…\n'
compose up -d mysql
mysql_id=$(compose ps -a -q mysql)
[[ -n "$mysql_id" ]] || fail '没有找到 MySQL 容器，请执行 docker compose logs --tail=100 mysql 查看原因。'
if [[ "$verified" == false ]]; then verify_credentials; fi
unset mysql_password mysql_root_password
printf 'MySQL 连接检查通过。\n'
if [[ "$mysql_only" == true ]]; then
  compose up -d --wait mysql
else
  compose up --build -d --wait
fi
compose ps
