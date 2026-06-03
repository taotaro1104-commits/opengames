const state = {
  query: "",
  genre: "",
  platform: "",
  language: "",
  license: "",
  status: "",
  sort: "stars",
  personalOnly: false,
  japaneseOnly: false,
  repoOnly: false,
  selectedSlug: null,
};

const data = window.OPEN_SOURCE_GAMES_DATA || { games: [] };
const games = data.games.map((game) => {
  const primaryRepo = game.repositories[0] || {};
  const stars = Number(primaryRepo.stars || 0);
  const lastCommit = primaryRepo.last_commit_date || "";
  const searchable = [
    game.title,
    game.description,
    game.author_community,
    game.code_license,
    game.asset_license,
    game.engine_framework,
    game.status,
    ...game.genres,
    ...game.platforms,
    ...game.languages.map((item) => item.name),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return { ...game, primaryRepo, stars, lastCommit, searchable };
});

const els = {
  dbMeta: document.getElementById("dbMeta"),
  searchInput: document.getElementById("searchInput"),
  genreFilter: document.getElementById("genreFilter"),
  platformFilter: document.getElementById("platformFilter"),
  languageFilter: document.getElementById("languageFilter"),
  licenseFilter: document.getElementById("licenseFilter"),
  statusFilter: document.getElementById("statusFilter"),
  sortSelect: document.getElementById("sortSelect"),
  personalOnly: document.getElementById("personalOnly"),
  japaneseOnly: document.getElementById("japaneseOnly"),
  repoOnly: document.getElementById("repoOnly"),
  resetButton: document.getElementById("resetButton"),
  visibleCount: document.getElementById("visibleCount"),
  totalCount: document.getElementById("totalCount"),
  activeCount: document.getElementById("activeCount"),
  personalCount: document.getElementById("personalCount"),
  japaneseCount: document.getElementById("japaneseCount"),
  resultSummary: document.getElementById("resultSummary"),
  gameList: document.getElementById("gameList"),
  detailEmpty: document.getElementById("detailEmpty"),
  detailView: document.getElementById("detailView"),
};

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ja")
  );
}

function fillSelect(select, values, allLabel = "すべて") {
  select.innerHTML = "";
  select.append(new Option(allLabel, ""));
  values.forEach((value) => select.append(new Option(value, value)));
}

const STATUS_LABELS = {
  active: "更新中",
  stale: "停滞気味",
  abandoned: "放棄",
  unknown: "不明",
};

const BUILD_COMPLEXITY_LABELS = {
  easy: "やさしい",
  normal: "通常",
  hard: "難しい",
  unknown: "不明",
};

function labelFrom(map, value, fallback = "不明") {
  return map[value] || value || fallback;
}

function starsLabel(value) {
  return value ? `スター ${value.toLocaleString()}` : "スター数不明";
}

function hasPersonalSite(game) {
  return game.distribution_channels.some(
    (channel) =>
      channel.channel_type === "personal_site" ||
      (channel.url || "").includes("github.io")
  );
}

function hasRepository(game) {
  return game.repositories.some((repo) => repo.repository_url);
}

function hasJapaneseSource(game) {
  return (
    game.slug.startsWith("jp-") ||
    game.distribution_channels.some((channel) => channel.channel_type === "japanese_source")
  );
}

function matchGame(game) {
  if (state.query && !game.searchable.includes(state.query.toLowerCase())) {
    return false;
  }
  if (state.genre && !game.genres.includes(state.genre)) {
    return false;
  }
  if (state.platform && !game.platforms.includes(state.platform)) {
    return false;
  }
  if (
    state.language &&
    !game.languages.some((language) => language.name === state.language)
  ) {
    return false;
  }
  if (state.license && game.code_license !== state.license) {
    return false;
  }
  if (state.status && game.status !== state.status) {
    return false;
  }
  if (state.personalOnly && !hasPersonalSite(game)) {
    return false;
  }
  if (state.japaneseOnly && !hasJapaneseSource(game)) {
    return false;
  }
  if (state.repoOnly && !hasRepository(game)) {
    return false;
  }
  return true;
}

function sortGames(items) {
  const sorted = [...items];
  sorted.sort((a, b) => {
    if (state.sort === "title") {
      return a.title.localeCompare(b.title, "ja");
    }
    if (state.sort === "recent") {
      return (b.lastCommit || "").localeCompare(a.lastCommit || "");
    }
    if (state.sort === "license") {
      return (a.code_license || "").localeCompare(b.code_license || "", "ja");
    }
    return b.stars - a.stars || a.title.localeCompare(b.title, "ja");
  });
  return sorted;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function externalLink(url, label) {
  if (!url) {
    return "";
  }
  return `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(
    label || url
  )}</a>`;
}

function imageSrc(url) {
  if (!url) {
    return "";
  }
  if (url.startsWith("assets/reference/")) {
    return "";
  }
  return url;
}

function visualSeed(value) {
  return Array.from(String(value || "Open Source Game")).reduce(
    (seed, char) => (seed * 31 + char.charCodeAt(0)) % 360,
    17
  );
}

function gameInitials(title) {
  const chars = Array.from(String(title || "OSG")).filter((char) =>
    /[\p{L}\p{N}]/u.test(char)
  );
  return chars.slice(0, 2).join("").toUpperCase() || "OS";
}

function generatedVisual(game, sizeClass) {
  const hue = visualSeed(game.slug || game.title);
  const style = `--visual-hue:${hue}`;
  const label = game.genres?.[0] || "OSS";
  return `
    <div class="${sizeClass} generated-visual" style="${escapeHtml(style)}" aria-hidden="true">
      <span>${escapeHtml(gameInitials(game.title))}</span>
      <small>${escapeHtml(label)}</small>
    </div>
  `;
}

function gameImage(game, sizeClass, alt = "") {
  const src = imageSrc(game.reference_image_url || "");
  if (!src) {
    return generatedVisual(game, sizeClass);
  }
  return `<img class="${sizeClass}" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" onerror="this.hidden=true">`;
}

function pill(value) {
  return `<span class="pill">${escapeHtml(value)}</span>`;
}

function statusLabel(status) {
  const value = status || "unknown";
  return `<span class="status ${escapeHtml(value)}">${escapeHtml(
    labelFrom(STATUS_LABELS, value)
  )}</span>`;
}

function renderGameCard(game) {
  const genres = game.genres.slice(0, 3).map(pill).join("");
  const languages = game.languages
    .slice(0, 2)
    .map((language) => pill(language.name))
    .join("");
  const stars = starsLabel(game.stars);
  const license = game.code_license || "ライセンス不明";
  const thumbnail = gameImage(game, "card-thumb");
  return `
    <button class="game-card ${
      state.selectedSlug === game.slug ? "active" : ""
    }" type="button" data-slug="${escapeHtml(game.slug)}">
      <div class="card-head">
        ${thumbnail}
        <div class="card-title">
          <strong>${escapeHtml(game.title)}</strong>
          <div class="meta-line">
            ${statusLabel(game.status)}
            <span class="pill">${escapeHtml(stars)}</span>
            <span class="pill">${escapeHtml(license)}</span>
          </div>
        </div>
      </div>
      <div class="description">${escapeHtml(game.description || "説明未登録")}</div>
      <div class="tag-row">${genres}${languages}</div>
    </button>
  `;
}

function renderList(items) {
  els.visibleCount.textContent = items.length.toLocaleString();
  els.resultSummary.textContent = `${items.length.toLocaleString()}件`;
  if (!items.length) {
    els.gameList.innerHTML = '<div class="empty-results">条件に合うゲームがありません</div>';
    renderDetail(null);
    return;
  }
  els.gameList.innerHTML = items.map(renderGameCard).join("");
  if (!state.selectedSlug || !items.some((game) => game.slug === state.selectedSlug)) {
    state.selectedSlug = items[0].slug;
  }
  renderDetail(items.find((game) => game.slug === state.selectedSlug));
}

function renderLinks(items, labelKey = "name") {
  if (!items.length) {
    return "<p>未登録</p>";
  }
  return `<ul class="link-list">${items
    .map(
      (item) =>
        `<li>${externalLink(item.url || item.repository_url, item[labelKey] || item.host || item.url || item.repository_url)}</li>`
    )
    .join("")}</ul>`;
}

function renderDetail(game) {
  if (!game) {
    els.detailEmpty.hidden = false;
    els.detailView.hidden = true;
    return;
  }
  els.detailEmpty.hidden = true;
  els.detailView.hidden = false;
  const repo = game.primaryRepo || {};
  els.detailView.innerHTML = `
    <div class="detail-title">
      ${
        gameImage(game, "detail-image", `${game.title} 参考画像`)
      }
      <h2>${escapeHtml(game.title)}</h2>
      <div class="meta-line">
        ${statusLabel(game.status)}
        ${pill(game.code_license || "ライセンス不明")}
        ${game.stars ? pill(starsLabel(game.stars)) : ""}
      </div>
      <p>${escapeHtml(game.description || "説明未登録")}</p>
    </div>

    <section class="detail-section">
      <h3>基本情報</h3>
      <dl class="kv">
        <dt>ジャンル</dt><dd>${game.genres.map(pill).join(" ") || "未登録"}</dd>
        <dt>プラットフォーム</dt><dd>${game.platforms.map(pill).join(" ") || "未登録"}</dd>
        <dt>言語</dt><dd>${game.languages.map((item) => pill(item.name)).join(" ") || "未登録"}</dd>
        <dt>作者・コミュニティ</dt><dd>${escapeHtml(game.author_community || "未登録")}</dd>
        <dt>初版年</dt><dd>${escapeHtml(game.release_year || "未登録")}</dd>
        <dt>参考画像URL</dt><dd>${externalLink(imageSrc(game.reference_image_url || ""), game.reference_image_url) || "未登録"}</dd>
      </dl>
    </section>

    <section class="detail-section">
      <h3>OSS情報</h3>
      <dl class="kv">
        <dt>コードライセンス</dt><dd>${escapeHtml(game.code_license || "未登録")}</dd>
        <dt>アセットライセンス</dt><dd>${escapeHtml(game.asset_license || "未登録")}</dd>
        <dt>エンジン</dt><dd>${escapeHtml(game.engine_framework || "未登録")}</dd>
        <dt>最新コミット</dt><dd>${escapeHtml(repo.last_commit_date || "未登録")}</dd>
        <dt>Fork</dt><dd>${escapeHtml(repo.forks ?? "未登録")}</dd>
      </dl>
    </section>

    <section class="detail-section">
      <h3>プレイ・拡張</h3>
      <dl class="kv">
        <dt>マルチプレイ</dt><dd>${escapeHtml(game.multiplayer_support || "未登録")}</dd>
        <dt>MOD</dt><dd>${escapeHtml(game.moddability || "未登録")}</dd>
        <dt>ビルド難易度</dt><dd>${escapeHtml(labelFrom(BUILD_COMPLEXITY_LABELS, game.build_complexity, "未登録"))}</dd>
        <dt>国際化</dt><dd>${escapeHtml(game.localization_status || "未登録")}</dd>
      </dl>
    </section>

    <section class="detail-section">
      <h3>リンク</h3>
      ${renderLinks([
        ...(game.official_url ? [{ name: "公式サイト", url: game.official_url }] : []),
        ...game.repositories.map((item) => ({
          name: item.host || "リポジトリ",
          url: item.repository_url,
        })),
        ...game.distribution_channels,
        ...game.community_links,
      ])}
    </section>

    <section class="detail-section">
      <h3>出典</h3>
      ${renderLinks(game.references, "label")}
    </section>
  `;
}

function render() {
  const filtered = sortGames(games.filter(matchGame));
  renderList(filtered);
}

function updateFromControls() {
  state.query = els.searchInput.value.trim();
  state.genre = els.genreFilter.value;
  state.platform = els.platformFilter.value;
  state.language = els.languageFilter.value;
  state.license = els.licenseFilter.value;
  state.status = els.statusFilter.value;
  state.sort = els.sortSelect.value;
  state.personalOnly = els.personalOnly.checked;
  state.japaneseOnly = els.japaneseOnly.checked;
  state.repoOnly = els.repoOnly.checked;
  render();
}

function init() {
  els.dbMeta.textContent = `${games.length.toLocaleString()}件 / 生成日 ${data.generated_on || "不明"}`;
  els.totalCount.textContent = games.length.toLocaleString();
  els.activeCount.textContent = games
    .filter((game) => game.status === "active")
    .length.toLocaleString();
  els.personalCount.textContent = games.filter(hasPersonalSite).length.toLocaleString();
  els.japaneseCount.textContent = games.filter(hasJapaneseSource).length.toLocaleString();

  fillSelect(els.genreFilter, uniqueSorted(games.flatMap((game) => game.genres)));
  fillSelect(els.platformFilter, uniqueSorted(games.flatMap((game) => game.platforms)));
  fillSelect(
    els.languageFilter,
    uniqueSorted(games.flatMap((game) => game.languages.map((item) => item.name)))
  );
  fillSelect(els.licenseFilter, uniqueSorted(games.map((game) => game.code_license)));

  [
    els.searchInput,
    els.genreFilter,
    els.platformFilter,
    els.languageFilter,
    els.licenseFilter,
    els.statusFilter,
    els.sortSelect,
    els.personalOnly,
    els.japaneseOnly,
    els.repoOnly,
  ].forEach((el) => el.addEventListener("input", updateFromControls));

  els.resetButton.addEventListener("click", () => {
    els.searchInput.value = "";
    els.genreFilter.value = "";
    els.platformFilter.value = "";
    els.languageFilter.value = "";
    els.licenseFilter.value = "";
    els.statusFilter.value = "";
    els.sortSelect.value = "stars";
    els.personalOnly.checked = false;
    els.japaneseOnly.checked = false;
    els.repoOnly.checked = false;
    Object.assign(state, {
      query: "",
      genre: "",
      platform: "",
      language: "",
      license: "",
      status: "",
      sort: "stars",
      personalOnly: false,
      japaneseOnly: false,
      repoOnly: false,
    });
    render();
  });

  els.gameList.addEventListener("click", (event) => {
    const card = event.target.closest(".game-card");
    if (!card) {
      return;
    }
    state.selectedSlug = card.dataset.slug;
    render();
  });

  render();
}

init();
