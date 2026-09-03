#!/usr/bin/env bash
# Teste: arquivar/desarquivar/excluir projeto + filtros. Uso: bash test_projetos_arquivar.sh <BASE>
# Usuários (test_users_rbac.sql): f3admin (ADMIN), f3colab (COLAB, Financeiro), f3colab2 (COLAB, RH), f3viewer (VISUALIZADOR)
set -u
BASE=${1:-http://127.0.0.1:5001}; PASS='Fase3Teste!2026'
OK=0; FAIL=0
pass(){ OK=$((OK+1)); echo "  PASS  $1"; }
fail(){ FAIL=$((FAIL+1)); echo "  FAIL  $1  -> $2"; }
check(){ if [ "$2" = "$3" ]; then pass "$1 ($3)"; else fail "$1" "esperado $2, veio $3 ${4:-}"; fi; }
req(){ local m=$1 p=$2 t=$3 d=${4:-}; local out
  if [ -n "$d" ]; then out=$(curl -s -o /tmp/pa -w "%{http_code}" -X "$m" "$BASE$p" -H "Content-Type: application/json" ${t:+-H "Authorization: Bearer $t"} -d "$d")
  else out=$(curl -s -o /tmp/pa -w "%{http_code}" -X "$m" "$BASE$p" ${t:+-H "Authorization: Bearer $t"}); fi
  CODE=$out; BODY=$(cat /tmp/pa); }
login(){ curl -s -X POST "$BASE/users/login" -H "Content-Type: application/json" -d "{\"email\":\"$1\",\"password\":\"$PASS\"}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token') or '')"; }
jget(){ python3 -c "import sys,json; d=json.load(sys.stdin); print(eval(\"d$1\"))" 2>/dev/null; }
has_id(){ python3 -c "import sys,json; d=json.load(sys.stdin); print(any(p.get('id')=='$1' for p in d))" 2>/dev/null; }
jlen(){ python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null; }

TA=$(login f3admin@teste.local); TB=$(login f3colab@teste.local); TD=$(login f3colab2@teste.local); TV=$(login f3viewer@teste.local)
IDD=$(curl -s "$BASE/users/me" -H "Authorization: Bearer $TD" | jget "['id']")

echo "== criação e serialização"
req POST /gestao/projects/ "$TB" '{"name":"Arquivável","description":"teste","start_date":"2026-09-01","end_date":"2026-12-31"}'; check "colab cria projeto" 201 "$CODE" "$BODY"
P=$(echo "$BODY" | jget "['project']['id']")
[ "$(echo "$BODY" | jget "['project']['archived_at']")" = "None" ] && [ "$(echo "$BODY" | jget "['project']['task_count']")" = "0" ] && pass "archived_at nulo e task_count=0 no serializer" || fail "serializer" "$BODY"
req POST /gestao/tasks/ "$TB" "{\"project_id\":\"$P\",\"title\":\"T1\",\"assignee_id\":$IDD}"; check "tarefa T1 (responsável colab2)" 201 "$CODE"
T1=$(echo "$BODY" | jget "['task']['id']"); [ -z "$T1" ] && T1=$(echo "$BODY" | jget "['id']")
req POST /gestao/tasks/ "$TB" "{\"project_id\":\"$P\",\"title\":\"T2\"}"; check "tarefa T2" 201 "$CODE"
req GET "/gestao/projects/$P" "$TB"; [ "$(echo "$BODY" | jget "['task_count']")" = "2" ] && pass "task_count=2" || fail "task_count" "$BODY"

echo "== arquivar"
req PATCH "/gestao/projects/$P" "$TD" '{"archived":true}'; check "colab2 (não dono) arquiva" 403 "$CODE"
req PATCH "/gestao/projects/$P" "$TV" '{"archived":true}'; check "VISUALIZADOR arquiva" 403 "$CODE"
req PATCH "/gestao/projects/$P" "$TB" '{"archived":true}'; check "dono arquiva" 200 "$CODE" "$BODY"
[ "$(echo "$BODY" | jget "['project']['archived_at']")" != "None" ] && pass "archived_at preenchido" || fail "archived_at" "$BODY"
req GET /gestao/projects/ "$TB"; [ "$(echo "$BODY" | has_id "$P")" = False ] && pass "some da lista padrão" || fail "lista padrão" "$BODY"
req GET "/gestao/projects/?include_archived=true" "$TB"; [ "$(echo "$BODY" | has_id "$P")" = True ] && pass "aparece com include_archived" || fail "include_archived" "$BODY"
req GET "/gestao/projects/$P" "$TB"; check "detalhe do arquivado continua acessível" 200 "$CODE"
req GET "/gestao/tasks/?top_level=true" "$TD"; N=$(echo "$BODY" | python3 -c "import sys,json; print(sum(1 for t in json.load(sys.stdin) if t.get('project_id')=='$P'))"); [ "$N" = "0" ] && pass "Kanban geral esconde tarefas do projeto arquivado (mesmo sendo responsável)" || fail "kanban geral" "$N"
req GET "/gestao/tasks/?project_id=$P" "$TB"; [ "$(echo "$BODY" | jlen)" = "2" ] && pass "tela do projeto arquivado ainda lista as 2 tarefas" || fail "tarefas do arquivado" "$BODY"
req PATCH "/gestao/projects/$P" "$TB" '{"archived":false}'; check "dono desarquiva" 200 "$CODE"
[ "$(echo "$BODY" | jget "['project']['archived_at']")" = "None" ] && pass "archived_at volta a nulo" || fail "desarquivar" "$BODY"
req GET "/gestao/tasks/?top_level=true" "$TD"; N=$(echo "$BODY" | python3 -c "import sys,json; print(sum(1 for t in json.load(sys.stdin) if t.get('project_id')=='$P'))"); [ "$N" = "2" ] && pass "Kanban geral volta a mostrar as tarefas (colab2 é responsável de T1, logo enxerga o projeto inteiro)" || fail "kanban volta" "$N"

echo "== editar (status/datas) pelo modal"
req PATCH "/gestao/projects/$P" "$TB" '{"status":"EM_ANDAMENTO","end_date":"2027-01-31"}'; check "dono edita status/data" 200 "$CODE" "$BODY"
[ "$(echo "$BODY" | jget "['project']['status']")" = "EM_ANDAMENTO" ] && pass "status salvo" || fail "status" "$BODY"

echo "== excluir"
req DELETE "/gestao/projects/$P" "$TD"; check "colab2 (não dono) exclui" 403 "$CODE"
req DELETE "/gestao/projects/$P" "$TV"; check "VISUALIZADOR exclui" 403 "$CODE"
req DELETE "/gestao/projects/$P" "$TB"; check "dono exclui" 200 "$CODE" "$BODY"
[ "$(echo "$BODY" | jget "['deleted_tasks']")" = "2" ] && pass "2 tarefas apagadas junto" || fail "deleted_tasks" "$BODY"
req GET "/gestao/projects/$P" "$TA"; check "projeto some (404)" 404 "$CODE"
req GET "/gestao/tasks/$T1" "$TA"; check "tarefa T1 some (404, não vira órfã)" 404 "$CODE"
req GET "/gestao/tasks/?top_level=true" "$TD"; N=$(echo "$BODY" | python3 -c "import sys,json; print(sum(1 for t in json.load(sys.stdin) if t.get('title') in ('T1','T2')))"); [ "$N" = "0" ] && pass "nenhuma tarefa órfã pro colab2" || fail "órfãs" "$N"
req DELETE "/gestao/projects/$P" "$TA"; check "excluir de novo" 404 "$CODE"
echo; echo "RESULTADO: $OK passaram, $FAIL falharam"; [ "$FAIL" = "0" ]
