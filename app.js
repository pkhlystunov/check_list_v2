// НА СТРОКЕ 2 УКАЖИТЕ ССЫЛКУ, КОТОРУЮ ВАМ ВЫДАЛ GOOGLE APPS SCRIPT ПРИ ДЕПЛОЕ:
const API_URL = "https://script.google.com/macros/s/AKfycbxmcn73GOtV-nsRUUSTA9ed-wE4EvI4uvIb5FgRZbV6H6kO-ML4ktxOb-9VOVtE_Kl_/exec"; 

let auditSession = { 
    inspector: '', 
    objectName: '', 
    contractor: '', 
    results: [] 
};

// Хранилище сгенерированного текста нарушений для PDF
let finalViolationsText = "";

document.addEventListener("DOMContentLoaded", async function() {
    const errorDiv = document.getElementById('error-display');
    const loadingEl = document.getElementById('setup-loading');
    
    try {
        const response = await fetch(API_URL + "?action=getSetupData", { method: "GET", redirect: "follow" });
        const rawText = await response.text();
        
        if (rawText.includes("Google Accounts") || rawText.includes("Sign in")) {
            throw new Error("Защита Google заблокировала анонимный доступ.");
        }
        
        const res = JSON.parse(rawText);
        if (!res.success) throw new Error(res.error || "Ошибка макроса");
        
        const objectSelect = document.getElementById('object-select');
        res.objects.forEach(obj => {
            objectSelect.add(new Option(obj.id + " | " + obj.name, obj.name));
        });
        
        const contractorSelect = document.getElementById('contractor-select');
        res.contractors.forEach(contr => {
            contractorSelect.add(new Option(contr, contr));
        });
        
        loadingEl.style.display = 'none';
        document.getElementById('form-fields-wrapper').style.display = 'block';
    } catch (error) {
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
    
    if(!insp || !obj || !contr) return alert("Заполните ФИО и выберите Объект и Подрядчика!");
    
    auditSession.inspector = insp; 
    auditSession.objectName = obj; 
    auditSession.contractor = contr;
    auditSession.results = [];
    finalViolationsText = "";
    
    // Блокируем кнопку PDF до момента сохранения в базу
    document.getElementById('pdf-btn').disabled = true;
    document.getElementById('submit-btn').disabled = false;
    document.getElementById('submit-btn').innerText = "1. Сохранить в Реестр Google 💾";
    
    document.getElementById('step-1-form').style.display = 'none';
    
    const container = document.getElementById('questions-container');
    container.innerHTML = "⏳ Загрузка вопросов чек-листа...";
    document.getElementById('step-3-checklist').style.display = 'block';
    
    document.getElementById('audit-meta-insp').textContent = auditSession.inspector;
    document.getElementById('audit-meta-obj').textContent = auditSession.objectName;
    document.getElementById('audit-meta-contr').textContent = auditSession.contractor;
    document.getElementById('audit-meta-date').textContent = new Date().toLocaleDateString('ru-RU');

    try {
        const response = await fetch(API_URL + "?action=getChecklist", { method: "GET", redirect: "follow" });
        const result = await response.json();
        if (!result.success) throw new Error(result.error);
        
        container.innerHTML = "";
        
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
            txt.textContent = q.question;
            card.appendChild(txt);
            
            if (q.normative) {
                const norm = document.createElement('div');
                norm.className = 'normative-text';
                norm.innerHTML = '<b>Норматив:</b> <span>' + q.normative + '</span>';
                card.appendChild(norm);
            }
            
            const btnRow = document.createElement('div');
            btnRow.className = 'btn-row';
            
            const btnOk = document.createElement('button');
            btnOk.type = 'button';
            btnOk.className = 'btn btn-success';
            btnOk.textContent = 'Соответствует';
            btnOk.onclick = function() { setQuestionResult(q.id, 'Соответствует', q.question, q.category, q.normative); };
            
            const btnFail = document.createElement('button');
            btnFail.type = 'button';
            btnFail.className = 'btn btn-danger';
            btnFail.textContent = 'Нарушение';
            btnFail.onclick = function() { setQuestionResult(q.id, 'Нарушение', q.question, q.category, q.normative); };
            
            btnRow.appendChild(btnOk);
            btnRow.appendChild(btnFail);
            card.appendChild(btnRow);
            
            const inp = document.createElement('input');
            inp.type = 'text';
            inp.id = 'comment-' + q.id;
            inp.className = 'comment-box';
            inp.placeholder = 'Опишите детали нарушения...';
            card.appendChild(inp);
            
            container.appendChild(card);
        });
    } catch(error) {
        container.innerHTML = "Ошибка загрузки вопросов: " + error.message;
    }
}

function setQuestionResult(id, status, questionText, categoryName, normativeText) {
    let item = auditSession.results.find(r => r.id === id);
    if (!item) {
        item = { id: id, question: questionText, category: categoryName, normative: normativeText, status: status, comment: '' };
        auditSession.results.push(item);
    } else { 
        item.status = status; 
    }
    
    const comp = document.getElementById('comment-' + id);
    if (comp) comp.style.display = status === 'Нарушение' ? 'block' : 'none';
    document.getElementById('q-box-' + id).style.borderLeftColor = status === 'Соответствует' ? 'var(--success)' : 'var(--danger)';
}

// КНОПКА 1: Только сохранение данных в Google
async function submitAuditOnly() {
    if (auditSession.results.length === 0) {
        return alert("Вы не провели оценку ни одного критерия из чек-листа!");
    }

    const violations = [];
    
    auditSession.results.forEach(item => {
        if (item.status === 'Нарушение') {
            const inp = document.getElementById('comment-' + item.id);
            const commentText = inp ? inp.value.trim() : '';
            
            let violationEntry = "• [" + item.category + "] " + item.question;
            if (item.normative) violationEntry += " (Пункт правил: " + item.normative + ")";
            violationEntry += "\n  Замечание инспектора: " + (commentText || "не расписано");
            
            violations.push(violationEntry);
        }
    });

    finalViolationsText = violations.length > 0 
        ? violations.join("\n\n") 
        : "Нарушений в ходе проверки не выявлено. Объект соответствует нормам ОТиПБ.";

    auditSession.aggregatedViolations = finalViolationsText;

    const btn = document.getElementById('submit-btn');
    btn.disabled = true; 
    btn.innerText = "⏳ Сохранение в таблицу...";

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(auditSession),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        
        await response.text();
        
        btn.innerText = "✅ Данные отправлены в Google!";
        // Переводим фокус на вторую кнопку и разблокируем её
        document.getElementById('pdf-btn').disabled = false;
        alert('Данные успешно сохранены во вкладку "7_Реестр_Проверок"! Теперь вы можете скачать файл, нажав на кнопку "2. Скачать Акт в PDF".');
        
    } catch(googleError) {
        console.error("Ошибка сохранения:", googleError);
        alert("Не удалось отправить данные в Google Таблицу. Проверьте подключение к сети.");
        btn.disabled = false;
        btn.innerText = "1. Сохранить в Реестр Google 💾";
    }
}

// КНОПКА 2: Только локальное скачивание сформированного PDF
async function downloadPdfOnly() {
    const pdfBtn = document.getElementById('pdf-btn');
    pdfBtn.disabled = true;
    pdfBtn.innerText = "⏳ Создание файла PDF...";
    
    try {
        const currentDateStr = new Date().toLocaleDateString('ru-RU');
        
        // Наполняем изолированный скрытый макет актуальными текстами
        document.getElementById('pdf-date').textContent = currentDateStr;
        document.getElementById('pdf-inspector').textContent = auditSession.inspector;
        document.getElementById('pdf-object').textContent = auditSession.objectName;
        document.getElementById('pdf-contractor').textContent = auditSession.contractor;
        document.getElementById('pdf-violations-list').textContent = finalViolationsText;

        const printElement = document.getElementById('pdf-hidden-template');

        const pdfOptions = {
            margin: 15,
            filename: 'Акт_ОТ_' + auditSession.objectName.replace(/[^a-zA-Z0-9а-яА-Я_]/g, "_") + '_' + currentDateStr + '.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        // Запускаем сборку и скачивание акта
        await html2pdf().set(pdfOptions).from(printElement).save();
        pdfBtn.innerText = "📄 Скачать еще раз";
        pdfBtn.disabled = false;
        // Спрашиваем инспектора о завершении сессии
        if (confirm("Акт успешно скачан! Очистить форму и вернуться на главный экран для новой проверки?")) {
            location.reload();
        }
        } catch(pdfError) {
        console.error("Ошибка PDF:", pdfError);
        alert('Не удалось запустить скачивание файла. Проверьте разрешения браузера на загрузку документов.');
        pdfBtn.disabled = false;
        pdfBtn.innerText = "2. Скачать Акт в PDF 📄";
    }
}
