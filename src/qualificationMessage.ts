export type QualificationMessageInput = {
  storeName: string;
  businessType: string;
  businessTypeOther: string;
  platform: string;
  platformOther: string;
  catalogSize: string;
  primaryGoal: string;
  primaryGoals: string[];
};

type CatalogTier = "smallest" | "lowerMid" | "upperMid" | "largest";
type BusinessType = "Multi-brand retailer" | "Skincare brand" | "Beauty marketplace" | "Other";
type Goal =
  | "Conversion"
  | "Average order value"
  | "Product discovery"
  | "Customer confidence"
  | "Reduce bad product choices";

const goals: Goal[] = [
  "Conversion",
  "Average order value",
  "Product discovery",
  "Customer confidence",
  "Reduce bad product choices",
];

const wordCount = (value: string) => value.trim().split(/\s+/).filter(Boolean).length;

const stableIndex = (parts: string[], length: number) => {
  const seed = parts.join("|");
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return length > 0 ? hash % length : 0;
};

const lowerFirst = (value: string) => (value ? `${value.charAt(0).toLowerCase()}${value.slice(1)}` : value);

const articleFor = (value: string) => (/^[aeiou]/i.test(value.trim()) ? "an" : "a");

const possessive = (value: string) => (value.endsWith("s") ? `${value}'` : `${value}'s`);

const getStoreName = (data: QualificationMessageInput) => data.storeName.trim() || "your store";

const normalizeCatalogTier = (catalogSize: string): CatalogTier => {
  if (catalogSize === "500+") {
    return "largest";
  }
  if (catalogSize.includes("100") && catalogSize.includes("500")) {
    return "upperMid";
  }
  if (catalogSize.includes("25") && catalogSize.includes("100")) {
    return "lowerMid";
  }
  return "smallest";
};

const normalizeBusinessType = (businessType: string): BusinessType => {
  if (
    businessType === "Multi-brand retailer" ||
    businessType === "Skincare brand" ||
    businessType === "Beauty marketplace"
  ) {
    return businessType;
  }
  return "Other";
};

const normalizeGoal = (goal: string): Goal | null => (goals.includes(goal as Goal) ? (goal as Goal) : null);

const getOrderedGoals = (data: QualificationMessageInput): Goal[] =>
  (data.primaryGoals.length > 0 ? data.primaryGoals : data.primaryGoal ? [data.primaryGoal] : [])
    .map(normalizeGoal)
    .filter((goal): goal is Goal => Boolean(goal));

const getPlatformPhrase = (data: QualificationMessageInput) => {
  const platform = data.platform === "Other" ? lowerFirst(data.platformOther.trim()) : data.platform;
  if (!platform || platform === "Other") {
    return "";
  }
  if (data.platform === "Other") {
    const article = /^(a|an|the)\s/i.test(platform) ? "" : `${articleFor(platform)} `;
    return `on ${article}${platform}`;
  }
  if (platform === "Magento / Adobe Commerce") {
    return "on Adobe Commerce";
  }
  return `on ${platform}`;
};

const shouldMentionPlatform = (data: QualificationMessageInput, goalsForMessage: Goal[]) => {
  const platform = data.platform === "Other" ? data.platformOther.trim() : data.platform;
  if (!platform || platform === "Other") {
    return false;
  }
  if (data.businessType === "Other" && data.platformOther.trim()) {
    return true;
  }
  if (platform === "Magento / Adobe Commerce" || platform === "Salesforce Commerce Cloud") {
    return true;
  }
  return (
    data.businessType === "Beauty marketplace" &&
    stableIndex([data.businessType, data.catalogSize, platform, ...goalsForMessage], 3) === 0
  );
};

const businessCatalogCopy: Record<BusinessType, Record<CatalogTier, (storeName: string, data: QualificationMessageInput) => string>> = {
  "Multi-brand retailer": {
    smallest: (storeName) =>
      `${possessive(storeName)} focused multi-brand catalog is not mainly a choice problem, but the right products still need to be easy to identify.`,
    lowerMid: (storeName) =>
      `With ${possessive(storeName)} growing multi-brand catalog, customers have enough choice for product selection to shape the buying decision.`,
    upperMid: (storeName) =>
      `With this many products across brands, ${storeName} has a stronger need to help customers narrow the catalog.`,
    largest: (storeName) =>
      `${possessive(storeName)} broad multi-brand catalog gives customers plenty of choice, but also makes it harder to identify what actually fits their needs.`,
  },
  "Skincare brand": {
    smallest: (storeName) =>
      `With ${possessive(storeName)} focused range, the opportunity is not about reducing choice but helping customers understand which products fit them and work together.`,
    lowerMid: (storeName) =>
      `${possessive(storeName)} range gives customers meaningful choice, which makes guidance around product fit and combinations increasingly valuable.`,
    upperMid: (storeName) =>
      `At this catalog size, ${possessive(storeName)} customers have enough alternatives that choosing products and building the right routine can become a real decision point.`,
    largest: (storeName) =>
      `With ${possessive(storeName)} broad product range, even a single-brand experience can create significant choice around products, concerns and routine combinations.`,
  },
  "Beauty marketplace": {
    smallest: (storeName) =>
      `For a beauty marketplace like ${storeName}, a focused selection makes each customer's relevant products easier to identify quickly.`,
    lowerMid: (storeName) =>
      `As ${possessive(storeName)} marketplace expands, customers have more brands and products to compare, making personalized guidance more valuable.`,
    upperMid: (storeName) =>
      `With this breadth of products and brands, ${possessive(storeName)} customers can quickly face too many plausible choices without a clear way to narrow them down.`,
    largest: (storeName) =>
      `At ${possessive(storeName)} scale, navigating the marketplace becomes part of the buying problem itself as customers compare products across brands and concerns.`,
  },
  Other: {
    smallest: (storeName, data) => {
      const custom = lowerFirst(data.businessTypeOther.trim() || "business");
      return `For ${articleFor(custom)} ${custom} like ${storeName}, a focused catalog creates an opportunity to make product selection more precise rather than simply reduce choice.`;
    },
    lowerMid: (storeName, data) => {
      const custom = lowerFirst(data.businessTypeOther.trim() || "business");
      return `For ${articleFor(custom)} ${custom} like ${storeName}, the growing range makes personalized product guidance increasingly useful.`;
    },
    upperMid: (storeName, data) => {
      const custom = lowerFirst(data.businessTypeOther.trim() || "business");
      return `For ${articleFor(custom)} ${custom} like ${storeName}, this catalog size creates enough choice for product selection to shape the customer journey.`;
    },
    largest: (storeName, data) => {
      const custom = lowerFirst(data.businessTypeOther.trim() || "business");
      return `For ${articleFor(custom)} ${custom} like ${storeName}, a catalog this broad creates a clear need to narrow the range around each customer.`;
    },
  },
};

const primaryGoalCopy: Record<Goal, string[]> = {
  Conversion: [
    "With conversion as the main priority, Skin ID can reduce decision friction",
    "Since conversion comes first, Skin ID can make the path from product discovery to purchase more direct",
    "The strongest opportunity around conversion is reducing uncertainty between finding products and choosing what to buy",
  ],
  "Average order value": [
    "With AOV as the main priority, Skin ID can show customers which products make sense together",
    "Since AOV comes first, the strongest use case is helping customers understand which products belong together",
    "For AOV, the main opportunity is turning isolated product decisions into more relevant routines",
  ],
  "Product discovery": [
    "With product discovery first, Skin ID can narrow the catalog around each customer",
    "Since product discovery comes first, Skin ID can surface the most relevant part of the catalog",
    "The strongest discovery use case is reducing how much of the catalog each customer needs to evaluate themselves",
  ],
  "Customer confidence": [
    "With customer confidence as the priority, Skin ID can give customers clearer reasons behind each recommendation",
    "Since customer confidence comes first, recommendations need to make the decision easier to understand and trust",
    "For customer confidence, the main opportunity is making recommendations feel justified rather than arbitrary",
  ],
  "Reduce bad product choices": [
    "With better product choices as the priority, Skin ID can filter the catalog around each customer's needs",
    "Since reducing bad product choices comes first, Skin ID can remove weaker matches before customers evaluate them",
    "The strongest use case is keeping poor-fit products out of the customer's consideration set from the start",
  ],
};

const secondaryGoalCopy: Record<Goal, Record<Goal, string>> = {
  Conversion: {
    Conversion: "",
    "Average order value": "while creating more opportunities for relevant product combinations",
    "Product discovery": "by surfacing relevant products earlier in the journey",
    "Customer confidence": "while giving customers stronger reasons to trust the recommendation",
    "Reduce bad product choices": "while filtering weaker matches before the customer decides",
  },
  "Average order value": {
    Conversion: "while removing friction from the purchase decision",
    "Average order value": "",
    "Product discovery": "by introducing relevant products that belong in the same routine",
    "Customer confidence": "while giving customers a clearer reason to trust those combinations",
    "Reduce bad product choices": "without sacrificing product fit",
  },
  "Product discovery": {
    Conversion: "so the path from discovery to purchase becomes more direct",
    "Average order value": "while revealing complementary products that make sense in the same routine",
    "Product discovery": "",
    "Customer confidence": "while giving customers context that makes discovery feel more decisive",
    "Reduce bad product choices": "while keeping poor-fit products out of consideration from the start",
  },
  "Customer confidence": {
    Conversion: "so greater certainty can make the final purchase decision easier",
    "Average order value": "while helping customers understand why several products belong together",
    "Product discovery": "by reducing the number of products customers need to evaluate",
    "Customer confidence": "",
    "Reduce bad product choices": "while steering customers away from products that do not fit their needs",
  },
  "Reduce bad product choices": {
    Conversion: "so a more relevant shortlist can make the purchase decision easier",
    "Average order value": "while still identifying complementary products that preserve product fit",
    "Product discovery": "while making discovery easier by reducing irrelevant choice",
    "Customer confidence": "while giving customers stronger reasons to trust what remains",
    "Reduce bad product choices": "",
  },
};

const tertiaryGoalCopy: Record<Goal, string[]> = {
  Conversion: [
    "keeping the path to purchase clearer",
    "adding a more direct purchase path",
    "reducing friction closer to purchase",
  ],
  "Average order value": [
    "creating room for more relevant product combinations",
    "adding opportunities to build a broader routine",
    "making complementary products easier to introduce",
  ],
  "Product discovery": [
    "making relevant products easier to discover",
    "supporting clearer discovery across the catalog",
    "reducing the work required to find relevant products",
  ],
  "Customer confidence": [
    "giving customers more confidence in what they choose",
    "adding stronger confidence behind each recommendation",
    "making those decisions easier to trust",
  ],
  "Reduce bad product choices": [
    "reducing exposure to less relevant products",
    "keeping fewer poor-fit products in the decision",
    "keeping weaker matches out of the customer's path",
  ],
};

const buildBusinessSentence = (data: QualificationMessageInput, messageGoals: Goal[]) => {
  const businessType = normalizeBusinessType(data.businessType);
  const tier = normalizeCatalogTier(data.catalogSize);
  const storeName = getStoreName(data);
  const sentence = businessCatalogCopy[businessType][tier](storeName, data);
  const platformPhrase = getPlatformPhrase(data);
  const platformSentencePhrase = platformPhrase ? `On ${platformPhrase.replace(/^on /, "")}` : "";

  if (!platformPhrase || !shouldMentionPlatform(data, messageGoals)) {
    return sentence;
  }

  if (businessType === "Other") {
    return sentence.replace(` like ${storeName}`, ` like ${storeName} ${platformPhrase}`);
  }

  if (businessType === "Beauty marketplace" && sentence.startsWith("For a beauty marketplace")) {
    return sentence.replace(` like ${storeName}`, ` like ${storeName} ${platformPhrase}`);
  }

  const joinedSentence = /^(With|At|As|For)\b/.test(sentence) ? lowerFirst(sentence) : sentence;
  return `${platformSentencePhrase}, ${joinedSentence}`;
};

const buildGoalSentence = (data: QualificationMessageInput, messageGoals: Goal[]) => {
  const [primaryGoal, secondaryGoal, tertiaryGoal] = messageGoals;
  const fallbackGoal: Goal = "Conversion";
  const primary = primaryGoal ?? fallbackGoal;
  const variant = stableIndex([data.businessType, data.catalogSize, primary, secondaryGoal ?? "", tertiaryGoal ?? ""], 3);
  const base = primaryGoalCopy[primary][variant];
  const secondary =
    secondaryGoal && secondaryGoal !== primary ? secondaryGoalCopy[primary][secondaryGoal] : "";
  const tertiary =
    tertiaryGoal && tertiaryGoal !== primary && tertiaryGoal !== secondaryGoal
      ? tertiaryGoalCopy[tertiaryGoal][stableIndex([primary, secondaryGoal ?? "", tertiaryGoal, data.catalogSize], 3)]
      : "";

  const withSecondary = secondary ? `${base} ${secondary}` : base;
  const withTertiary = tertiary ? `${withSecondary} and ${tertiary}` : withSecondary;
  const sentence = `${withTertiary}.`;

  if (tertiary && wordCount(sentence) + 40 > 65) {
    return `${withSecondary}.`;
  }

  return sentence;
};

export const buildQualificationMessage = (data: QualificationMessageInput) => {
  const messageGoals = getOrderedGoals(data);
  const businessSentence = buildBusinessSentence(data, messageGoals);
  const goalSentence = buildGoalSentence(data, messageGoals);
  const fullMessage = `${businessSentence} ${goalSentence}`;

  if (wordCount(fullMessage) > 68 && messageGoals.length > 2) {
    return `${businessSentence} ${buildGoalSentence(data, messageGoals.slice(0, 2))}`;
  }

  return fullMessage;
};
