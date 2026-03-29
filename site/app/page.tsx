import { Nav } from "./components/nav";
import { Hero } from "./components/hero";
import { CodeExample } from "./components/code-example";
import { Features } from "./components/features";
import { HowItWorks } from "./components/how-it-works";
import { BYOK } from "./components/byok";
import { CTA } from "./components/cta";
import { Footer } from "./components/footer";

export default function Home() {
	return (
		<>
			<Nav />
			<Hero />
			<CodeExample />
			<Features />
			<HowItWorks />
			<BYOK />
			<CTA />
			<Footer />
		</>
	);
}
