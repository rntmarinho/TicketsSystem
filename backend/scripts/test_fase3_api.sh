#!/usr/bin/env bash
# Teste de API da Fase 3 (chat/presença/chamadas/portal) contra a stack de teste.
# Uso: bash test_fase3.sh <BASE_URL> <PROJECT_ID> <OTHER_PROJECT_ID>
# Usuários de teste (criados por SQL antes): f3admin/f3gestor/f3colab/f3colab2/f3cliente @teste.local, senha Fase3Teste!2026
set -u
BASE=${1:-http://127.0.0.1:5001}
PID=${2:-}
PID2=${3:-}
PASS='Fase3Teste!2026'
OK=0; FAIL=0
pass(){ OK=$((OK+1)); echo "  PASS  $1"; }
fail(){ FAIL=$((FAIL+1)); echo "  FAIL  $1  -> $2"; }
check(){ # check <desc> <expected_status> <actual_status> [body]
  if [ "$2" = "$3" ]; then pass "$1 ($3)"; else fail "$1" "esperado $2, veio $3 ${4:-}"; fi
}
req(){ # req <method> <path> <token> [json] -> sets CODE, BODY
  local m=$1 p=$2 t=$3 d=${4:-}
  local out
  if [ -n "$d" ]; then
    out=$(curl -s -o /tmp/f3body -w "%{http_code}" -X "$m" "$BASE$p" -H "Content-Type: application/json" ${t:+-H "Authorization: Bearer $t"} -d "$d")
  else
    out=$(curl -s -o /tmp/f3body -w "%{http_code}" -X "$m" "$BASE$p" ${t:+-H "Authorization: Bearer $t"})
  fi
  CODE=$out; BODY=$(cat /tmp/f3body)
}
login(){ curl -s -X POST "$BASE/users/login" -H "Content-Type: application/json" -d "{\"email\":\"$1\",\"password\":\"$PASS\"}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token') or d.get('access_token') or '')"; }
jget(){ python3 -c "import sys,json; d=json.load(sys.stdin); print(eval(\"d$1\"))" 2>/dev/null; }

echo "== health"
req GET /health ""; check "GET /health" 200 "$CODE" "$BODY"

echo "== login"
TA=$(login f3admin@teste.local); TG=$(login f3gestor@teste.local); TB=$(login f3colab@teste.local); TD=$(login f3colab2@teste.local); TC=$(login f3cliente@teste.local)
for n in TA TG TB TD TC; do [ -n "${!n}" ] && pass "login $n" || fail "login $n" "token vazio"; done
IDG=$(curl -s "$BASE/users/me" -H "Authorization: Bearer $TG" | jget "['id']")
IDB=$(curl -s "$BASE/users/me" -H "Authorization: Bearer $TB" | jget "['id']")
IDD=$(curl -s "$BASE/users/me" -H "Authorization: Bearer $TD" | jget "['id']")
IDC=$(curl -s "$BASE/users/me" -H "Authorization: Bearer $TC" | jget "['id']")
echo "  ids: gestor=$IDG colab=$IDB colab2=$IDD cliente=$IDC"
GERAL=$(curl -s "$BASE/gestao/teams/" -H "Authorization: Bearer $TA" | python3 -c "import sys,json; print([t['id'] for t in json.load(sys.stdin) if t['name']=='Geral'][0])")
OUTRA=$(curl -s "$BASE/gestao/teams/" -H "Authorization: Bearer $TA" | python3 -c "import sys,json; print([t['id'] for t in json.load(sys.stdin) if t['name']!='Geral'][0])")
echo "  teams: geral=$GERAL outra=$OUTRA"

echo "== guardas de acesso"
req GET /gestao/messages/unread ""; check "unread sem token" 401 "$CODE"
req GET /gestao/messages/unread "$TC"; check "unread como CLIENTE" 403 "$CODE"
req GET /gestao/presence/ "$TC"; check "presence como CLIENTE" 403 "$CODE"
req POST /gestao/presence/heartbeat "$TC"; check "heartbeat como CLIENTE" 403 "$CODE"
req GET /gestao/projects/ "$TC"; check "/gestao/projects como CLIENTE" 403 "$CODE"
req GET /portal-cliente/projects ""; check "portal sem token" 401 "$CODE"

echo "== presença"
req POST /gestao/presence/heartbeat "$TG"; check "heartbeat gestor" 200 "$CODE"
req GET /gestao/presence/ "$TB"; check "listar presença" 200 "$CODE"
ON=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print([p['online'] for p in d if p['user_id']==$IDG][0])")
[ "$ON" = "True" ] && pass "gestor aparece online" || fail "gestor aparece online" "$ON"
ONB=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print([p['online'] for p in d if p['user_id']==$IDB][0])")
[ "$ONB" = "False" ] && pass "colab (sem heartbeat) aparece offline" || fail "colab offline" "$ONB"

echo "== chat de equipe"
req POST "/gestao/messages/team/$GERAL" "$TG" '{"body":"Olá equipe, teste Fase 3"}'; check "gestor envia msg equipe Geral" 201 "$CODE" "$BODY"
req POST "/gestao/messages/team/$GERAL" "$TG" '{"body":"   "}'; check "msg vazia rejeitada" 422 "$CODE"
LONG=$(python3 -c "print('x'*4001)")
req POST "/gestao/messages/team/$GERAL" "$TG" "{\"body\":\"$LONG\"}"; check "msg >4000 chars rejeitada" 422 "$CODE"
req POST "/gestao/messages/team/$OUTRA" "$TB" '{"body":"intruso"}'; check "colab não-membro envia em outra equipe" 403 "$CODE"
req GET "/gestao/messages/team/$OUTRA" "$TB"; check "colab não-membro lê outra equipe" 403 "$CODE"
req GET "/gestao/messages/team/$OUTRA" "$TA"; check "ADMIN lê qualquer equipe" 200 "$CODE"
req GET /gestao/messages/unread "$TB"; check "unread colab antes de ler" 200 "$CODE"
CNT=$(echo "$BODY" | jget "['team_unread'].get('$GERAL',0)")
[ "$CNT" -ge 1 ] && pass "colab tem $CNT não lida(s) na Geral" || fail "não lida equipe" "$BODY"
req GET "/gestao/messages/team/$GERAL" "$TB"; check "colab lê equipe Geral" 200 "$CODE"
echo "$BODY" | grep -q "teste Fase 3" && pass "mensagem do gestor visível pro colab" || fail "msg visível" "$BODY"
req GET /gestao/messages/unread "$TB"; CNT=$(echo "$BODY" | jget "['team_unread'].get('$GERAL',0)")
[ "$CNT" = "0" ] && pass "não lidas zeradas após leitura" || fail "zerar não lidas" "$BODY"

echo "== chat direto"
req POST "/gestao/messages/direct/$IDB" "$TG" '{"body":"oi colab, direto"}'; check "gestor -> colab DM" 201 "$CODE" "$BODY"
req POST "/gestao/messages/direct/$IDG" "$TG" '{"body":"pra mim mesmo"}'; check "DM pra si mesmo rejeitada" 422 "$CODE"
req GET /gestao/messages/unread "$TB"; DU=$(echo "$BODY" | jget "['direct_unread']")
[ "$DU" = "1" ] && pass "colab tem 1 DM não lida" || fail "DM não lida" "$BODY"
req GET "/gestao/messages/direct/$IDG" "$TB"; check "colab lê DM" 200 "$CODE"
req GET "/gestao/messages/direct/$IDB" "$TG"; RA=$(echo "$BODY" | jget "[0]['read_at']")
[ "$RA" != "None" ] && [ -n "$RA" ] && pass "read_at marcado ($RA)" || fail "read_at" "$BODY"
req GET "/gestao/messages/direct/$IDB" "$TD"; NB=$(echo "$BODY" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
[ "$NB" = "0" ] && pass "terceiro (colab2) não vê a DM gestor<->colab" || fail "isolamento DM" "$BODY"

echo "== chamadas"
req POST "/gestao/messages/direct/$IDB/call" "$TG"; check "gestor chama colab" 201 "$CODE" "$BODY"
URL=$(echo "$BODY" | jget "['jitsi_url']"); echo "$URL" | grep -q '^https://meet.jit.si/Consominas-' && pass "jitsi_url gerada ($URL)" || fail "jitsi_url" "$BODY"
req GET /gestao/messages/incoming-calls "$TB"; N=$(echo "$BODY" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
[ "$N" -ge 1 ] && pass "colab vê chamada chegando" || fail "incoming colab" "$BODY"
req GET /gestao/messages/incoming-calls "$TG"; N=$(echo "$BODY" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
[ "$N" = "0" ] && pass "quem ligou não vê a própria chamada como recebida" || fail "incoming gestor" "$BODY"
req GET /gestao/messages/incoming-calls "$TD"; N=$(echo "$BODY" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
[ "$N" = "0" ] && pass "terceiro não vê a chamada" || fail "incoming colab2" "$BODY"
req POST "/gestao/messages/team/$OUTRA/call" "$TB"; check "colab chama equipe que não participa" 403 "$CODE"
req GET /gestao/messages/calls "$TG"; check "histórico de chamadas" 200 "$CODE"
echo "$BODY" | grep -q 'meet.jit.si' && pass "histórico contém a chamada" || fail "histórico" "$BODY"

echo "== anexos no chat"
echo "conteudo de teste" > /tmp/f3.txt; cp /tmp/f3.txt /tmp/f3.exe
CODE=$(curl -s -o /tmp/f3body -w "%{http_code}" -X POST "$BASE/gestao/messages/team/$GERAL/attachment" -H "Authorization: Bearer $TG" -F "arquivo=@/tmp/f3.txt"); BODY=$(cat /tmp/f3body)
check "upload anexo equipe (.txt)" 201 "$CODE" "$BODY"; ATT=$(echo "$BODY" | jget "['attachment']['id']")
CODE=$(curl -s -o /tmp/f3body -w "%{http_code}" -X POST "$BASE/gestao/messages/team/$GERAL/attachment" -H "Authorization: Bearer $TG" -F "arquivo=@/tmp/f3.exe"); check "upload .exe rejeitado" 400 "$CODE"
CODE=$(curl -s -o /tmp/f3body -w "%{http_code}" -X POST "$BASE/gestao/messages/team/$OUTRA/attachment" -H "Authorization: Bearer $TB" -F "arquivo=@/tmp/f3.txt"); check "upload em equipe alheia" 403 "$CODE"
req GET "/gestao/messages/team/$GERAL" "$TB"; echo "$BODY" | grep -q "\"attachment\": {\"file_name\": \"f3.txt\"\|\"file_name\":\"f3.txt\"\|f3.txt" && pass "anexo aparece na mensagem" || fail "anexo na msg" "$BODY"
CODE=$(curl -s -o /tmp/f3dl -w "%{http_code}" "$BASE/gestao/attachments/$ATT/download?token=$TB"); check "colab (membro) baixa anexo" 200 "$CODE"
grep -q "conteudo de teste" /tmp/f3dl && pass "conteúdo baixado confere" || fail "conteúdo" "$(head -c 100 /tmp/f3dl)"
CODE=$(curl -s -o /tmp/f3dl -w "%{http_code}" "$BASE/gestao/attachments/$ATT/download?token=$TC"); check "CLIENTE baixa anexo de chat" 403 "$CODE"
CODE=$(curl -s -o /tmp/f3body -w "%{http_code}" -X POST "$BASE/gestao/messages/direct/$IDB/attachment" -H "Authorization: Bearer $TG" -F "arquivo=@/tmp/f3.txt"); BODY=$(cat /tmp/f3body)
check "upload anexo DM" 201 "$CODE" "$BODY"; ATT2=$(echo "$BODY" | jget "['attachment']['id']")
CODE=$(curl -s -o /tmp/f3dl -w "%{http_code}" "$BASE/gestao/attachments/$ATT2/download?token=$TD"); check "terceiro baixa anexo de DM alheia" 404 "$CODE"
CODE=$(curl -s -o /tmp/f3dl -w "%{http_code}" "$BASE/gestao/attachments/$ATT2/download?token=$TB"); check "destinatário baixa anexo de DM" 200 "$CODE"

echo "== portal do cliente"
if [ -z "$PID" ]; then
  req POST /gestao/projects/ "$TA" "{\"name\":\"Projeto Portal Teste A\",\"team_id\":\"$GERAL\",\"description\":\"criado pelo teste da Fase 3\"}"; check "ADMIN cria projeto A" 201 "$CODE" "$BODY"
  PID=$(echo "$BODY" | jget "['project']['id']")
  req POST /gestao/projects/ "$TA" "{\"name\":\"Projeto Portal Teste B\",\"team_id\":\"$GERAL\"}"; check "ADMIN cria projeto B" 201 "$CODE" "$BODY"
  PID2=$(echo "$BODY" | jget "['project']['id']")
  req POST /gestao/tasks/ "$TA" "{\"project_id\":\"$PID\",\"title\":\"Tarefa visível no portal\",\"assignee_id\":$IDG}"; check "ADMIN cria tarefa no projeto A" 201 "$CODE" "$BODY"
  echo "  projetos: A=$PID B=$PID2"
fi
req GET /portal-cliente/projects "$TC"; check "cliente lista projetos (nenhum vinculado)" 200 "$CODE"
[ "$BODY" = "[]" ] && pass "lista vazia antes do vínculo" || fail "lista vazia" "$BODY"
req GET "/portal-cliente/projects/$PID" "$TC"; check "cliente abre projeto não vinculado" 404 "$CODE"
req POST "/gestao/projects/$PID/clients" "$TB" "{\"user_id\":$IDC}"; check "colab comum vincula cliente" 403 "$CODE"
req POST "/gestao/projects/$PID/clients" "$TA" "{\"user_id\":$IDC}"; check "ADMIN vincula cliente" 200 "$CODE" "$BODY"
req POST "/gestao/projects/$PID/clients" "$TA" "{\"user_id\":$IDC}"; check "vínculo repetido idempotente" 200 "$CODE"
req GET "/gestao/projects/$PID/clients" "$TA"; check "lista clientes do projeto" 200 "$CODE"
echo "$BODY" | grep -q "f3cliente\|Cliente Fase3" && pass "cliente na lista" || fail "cliente na lista" "$BODY"
req GET /portal-cliente/projects "$TC"; N=$(echo "$BODY" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
[ "$N" = "1" ] && pass "cliente vê 1 projeto" || fail "cliente vê projeto" "$BODY"
req GET "/portal-cliente/projects/$PID" "$TC"; check "cliente abre o projeto vinculado" 200 "$CODE"
req GET "/portal-cliente/projects/$PID/tasks" "$TC"; check "cliente lista tarefas" 200 "$CODE"
if [ -n "$PID2" ]; then req GET "/portal-cliente/projects/$PID2/tasks" "$TC"; check "cliente lista tarefas de projeto NÃO vinculado" 404 "$CODE"; fi
req GET "/portal-cliente/projects/$PID" "$TG"; check "staff sem vínculo no portal" 404 "$CODE"
req DELETE "/gestao/projects/$PID/clients/$IDC" "$TA"; check "ADMIN remove vínculo" 200 "$CODE"
req GET /portal-cliente/projects "$TC"; [ "$BODY" = "[]" ] && pass "lista vazia após remover" || fail "lista após remover" "$BODY"

echo
echo "RESULTADO: $OK passaram, $FAIL falharam"
[ "$FAIL" = "0" ]
