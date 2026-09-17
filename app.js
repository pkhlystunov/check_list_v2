// НА СТРОКЕ 2 УКАЖИТЕ ССЫЛКУ, КОТОРУЮ ВАМ ВЫДАЛ GOOGLE APPS SCRIPT ПРИ ДЕПЛОЕ:
const API_URL = "https://script.google.com/macros/s/AKfycbxUPzmukkziD2Nb1KY115W6Mzlr8lOj5TJ9bgZIaPrKN-k1arAnWkTkj-LhXogh9xJD/exec"; 

let auditSession = { 
    inspector: '', 
    objectName: '', 
    contractor: '', 
    results: [] 
};

document.addEventListener("DOMContentLoaded", async function() {
    const errorDiv = document.getElementById('error-display');
    const loadingEl = document.getElementById('setup-loading');
    
    const timeoutId = setTimeout(() => {
        if (loadingEl.style.display !== 'none') {
            loadingEl.style.display = 'none';
            errorDiv.style.display = 'block';
            errorDiv.innerHTML = '🔴 Ошибка таймаута. Google Сервер долго не отвечает.';
        }
    }, 12000);

    try {
        const response = await fetch(API_URL + "?action=getSetupData", { method: "GET", redirect: "follow" });
        clearTimeout(timeoutId);
        
        const rawText = await response.text();
        
        if (rawText.includes("Google Accounts") || rawText.includes("Sign in")) {
            throw new Error("Защита Google заблокировала анонимный доступ.");
        }
        
        const res = JSON.parse(rawText);
        if (!res.success) {
            throw new Error(res.error || "Ошибка макроса");
        }
        
        const objectSelect = document.getElementById('object-select');
        res.objects.forEach(obj => {
            const textValue = obj.id + " | " + obj.name;
            const optionItem = new Option(textValue, obj.name);
            objectSelect.add(optionItem);
        });
        
        const contractorSelect = document.getElementById('contractor-select');
        res.contractors.forEach(contr => {
            const optionItem = new Option(contr, contr);
            contractorSelect.add(optionItem);
        });
        
        loadingEl.style.display = 'none';
        document.getElementById('form-fields-wrapper').style.display = 'block';
    } catch (error) {
        clearTimeout(timeoutId);
        loadingEl.style.display = 'none';
        errorDiv.style.display = 'block';
        errorDiv.innerHTML = '❌ Ошибка инициализации API:\n' + error.message;
    }
});

function backToStep1() { 
    document.getElementById('step-3-checklist').style.display = 'none'; 
    document.getElementById('step-1-form').style.display = 'block'; 
}

async function startFullAudit() {
    const insp = document.getElementById('inspector').value.trim();
    const obj = document.getElementById('object-select').value;
    const contr = document.getElementById('contractor-select').value;
    
    if(!insp || !obj || !contr) {
        return alert("Заполните ФИО и выберите Объект и Подрядчика из списков!");
    }
    
    auditSession.inspector = insp; 
    auditSession.objectName = obj; 
    auditSession.contractor = contr;
    auditSession.results = [];
    
    document.getElementById('step-1-form').style.display = 'none';
    
    const container = document.getElementById('questions-container');
    container.innerHTML = "<div class='loading-overlay'>⏳ Загрузка полного чек-листа требований безопасности...</div>";
    document.getElementById('step-3-checklist').style.display = 'block';
    
    document.getElementById('audit-meta-insp').textContent = auditSession.inspector;
    document.getElementById('audit-meta-obj').textContent = auditSession.objectName;
    document.getElementById('audit-meta-contr').textContent = auditSession.contractor;

    try {
        let url = API_URL + "?action=getChecklist";
        const response = await fetch(url, { method: "GET", redirect: "follow" });
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error);
        }
        
        container.innerHTML = "";
        if(result.data.length === 0) { 
            container.innerHTML = "<p class='loading-overlay'>В таблице '3_Чек_лист' не обнаружено вопросов.</p>"; 
            return; 
        }
        
        result.data.forEach(q => {
            const card = document.createElement('div');
            card.className = 'card';
            card.id = 'q-box-' + q.id;
            
            const badge = document.createElement('div');
            badge.className = 'badge';
            badge.textContent = q.category;
            card.appendChild(badge);
            
            const txt = document.createElement('p');
            txt.style.margin = '5px 0 12px 0';
            txt.style.fontSize = '16px';
            txt.style.lineHeight = '1.4';
            txt.textContent = q.question;
            card.appendChild(txt);
            
            if (q.normative) {
                const norm = document.createElement('div');
                norm.className = 'normative-text';
                norm.innerHTML = '<b>Норматив:</b> ';
                const normSpan = document.createElement('span');
                normSpan.textContent = q.normative;
                norm.appendChild(normSpan);
                card.appendChild(norm);
            }
            
            const btnRow = document.createElement('div');
            btnRow.className = 'btn-row';
            
            const btnOk = document.createElement('button');
            btnOk.type = 'button';
            btnOk.className = 'btn btn-success';
            btnOk.textContent = 'Соответствует';
            btnOk.onclick = function() { 
                setQuestionResult(q.id, 'Соответствует', q.question, q.category); 
            };
            
            const btnFail = document.createElement('button');
            btnFail.type = 'button';
            btnFail.className = 'btn btn-danger';
            btnFail.textContent = 'Нарушение';
            btnFail.onclick = function() { 
                setQuestionResult(q.id, 'Нарушение', q.question, q.category); 
            };
            
            btnRow.appendChild(btnOk);
            btnRow.appendChild(btnFail);
            card.appendChild(btnRow);
            
            const inp = document.createElement('input');
            inp.type = 'text';
            inp.id = 'comment-' + q.id;
            inp.className = 'comment-box';
            inp.placeholder = 'Опишите список нарушений и дефектов...';
            card.appendChild(inp);
            
            container.appendChild(card);
        });
    } catch(error) {
        container.innerHTML = "<div class='card' style='border-left-color:var(--danger); color:var(--danger);'><b>Ошибка загрузки вопросов:</b><br>" + error.message + "</div>";
    }
}

function setQuestionResult(id, status, questionText, categoryName) {
    let item = auditSession.results.find(r => r.id === id);
    if (!item) {
        item = { 
            id: id, 
            question: questionText, 
            category: categoryName, 
            status: status, 
            comment: '' 
        };
        auditSession.results.push(item);
    } else { 
        item.status = status; 
    }
    
    const comp = document.getElementById('comment-' + id);
    if (comp) {
        comp.style.display = status === 'Нарушение' ? 'block' : 'none';
    }
    document.getElementById('q-box-' + id).style.borderLeftColor = status === 'Соответствует' ? 'var(--success)' : 'var(--danger)';
}

async function submitAudit() {
    if (auditSession.results.length === 0) {
        return alert("Вы не провели оценку ни одного критерия из чек-листа!");
    }
    
    auditSession.results.forEach(item => {
        const inp = document.getElementById('comment-' + item.id);
        if(inp) {
            item.comment = inp.value.trim();
        }
    });
    
    const btn = document.getElementById('submit-btn');
    btn.disabled = true; 
    btn.innerText = "Идет выгрузка результатов обхода...";
    
    try {
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(auditSession),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        alert('Успешно сохранено! Результаты проверки внесены в реестр таблицы.');
        location.reload();
    } catch(error) {
        alert("Ошибка отправки данных. Подробнее в консоли разработчика F12.");
        btn.disabled = false; 
        btn.innerText = "Сохранить аудит в Google Таблицу";
    }
}
