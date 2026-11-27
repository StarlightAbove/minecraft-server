import StatusBoard from "@/components/StatusBoard";
import { SITE } from "@/lib/config";
import { getStatus } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function Home() {
  return (
    <>
      <nav className="nav">
        <div className="wrap">
          <a className="brand" href="#top">
            <img src="/icon.svg" alt="" width={28} height={28} />
            {SITE.title}
          </a>
          <div className="links">
            <a href="#players">Players</a>
            <a href="#map">Map</a>
            <a href="#modpack">Modpack</a>
          </div>
        </div>
      </nav>

      <main id="top">
        <StatusBoard initial={await getStatus()} />

        <section className="section wrap map" id="map" aria-labelledby="map-heading">
          <h2 id="map-heading">World Map</h2>
          <p className="map-note">
            The map only renders as far as chunks have loaded. This is a technical Minecraft
            limitation. If you wanna see more of the map, explore!
          </p>
          {SITE.mapUrl ? (
            <>
              <iframe className="map-view" src={SITE.mapUrl} title="World map" loading="lazy" />
              <a className="button map-open" href={SITE.mapUrl} target="_blank" rel="noopener noreferrer">
                Open Full Map
              </a>
            </>
          ) : (
            <p className="map-view map-pending">Cartographers are hard at work!</p>
          )}
        </section>

        <section className="band" id="modpack" aria-labelledby="modpack-heading">
          <div className="wrap feature">
            <div className="frame">
              <img src="/art/blocks.svg" alt="" />
            </div>
            <div>
              <h2 id="modpack-heading">The Modpack</h2>
              <p>
                Grab the modpack currently running on the server, so your game matches mine before
                you join.
              </p>
              <dl className="specs">
                <div>
                  <dt>Minecraft</dt>
                  <dd>{SITE.minecraftVersion}</dd>
                </div>
                <div>
                  <dt>Mod loader</dt>
                  <dd>{SITE.loader}</dd>
                </div>
              </dl>
              <a className="button gold" href={SITE.modpackUrl} target="_blank" rel="noopener noreferrer">
                Download Modpack
              </a>

              <div className="launcher">
                <p>
                  <strong>Recommended launcher:</strong> I advise using Prism Launcher for ease of
                  use.
                </p>
                <a className="button" href={SITE.launcherUrl} target="_blank" rel="noopener noreferrer">
                  Download Prism Launcher
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <p className="credit">Built by Eliza with ❤️</p>
        <p>Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft.</p>
      </footer>
    </>
  );
}
