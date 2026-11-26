# minecraft-server
Backup for website and Minecraft server that I run for friends.

Feel free to copy my different configs and the like, and my map if you want it for whatever reason.
This uses a very specific stack. I host this on a server which also holds a bunch of other data on it, so it is a self-contained thing. The main reason I developed this was because my house uses business modem endpoints (yay, massive managed apartment buildings!), meaning I can't port-forward easily, and neither did I want to due to the security risks. But also being a student, I DEFINITELY didn't want to pay money for a VPS. 

The whole architecture is based on Docker and Docker Compose.
1. Using [```itzg/minecraft-server```](https://github.com/itzg/docker-minecraft-server), the server is booted up with generous thread and RAM allowances.
2. The entire server uses an internal reverse proxy via [```itzg/mc-router```](https://github.com/itzg/mc-router). While this is a bit overkill, I kept it in case I ever wanted to add parallel instances. Honestly, you can do this with Caddy as well.
3. I got myself a free Oracle Free Tier account for their VPS. Typically, VPS is paid, so you either have to pay a bit of moolah or you end up with something like playit.gg, which then assigns you incredibly silly names (my server was named stallion-anderson.tun.ply.gg). I am not unironically sending my friends that link. Oracle gives me enough headroom with the actual VPS bandwidth that the free tier is more than enough for me (10TB). Even if my friends had nothing better to do, and were on the server, say, 24/7 for a month, it would be 24 * 30 * 8 = 5760 player hours. My server isn't hosting 50 mods making Minecraft into Rust, it is basic Create + some nice additions for the builders among us. So let's be incredibly uncharitable and say 200MB per player hour, we are still only using a little more than one terabyte of bandwidth.

**How to set up the VPS Instance (Partial Instructions)**

If it was complex, I would've needed so much longer to figure it out. It isn't. Here's the simple instructions.
- Search up "Oracle Free Tier" in Google, click the Oracle link, and sign up. Once you do the rigamarole, you'll eventually have an account.
- Sign into Oracle Cloud. From the hamburger menu, go to Compute > Instances. Create a new instance. Name it as your heart desires, and for the Image, select Ubuntu 24.04.
- For Networking, make sure to create a new VNIC with a public subnet. It will not work if you do not do this.
- Make sure to copy the SSH keys. They are needed to log into the machine and actually do stuff on there.
- Click through. You don't need to do any more config. Click create. Give the server a moment to come online.
- While you are waiting, go back to the hamburger menu, and go Networking > Reserved Public IP. This is so that you aren't breaking your DNS records every time from the VPS changing its IP address.
- Create a reserved IP. It will randomly assign one to you, that's fine.
- Once you can see your new IP, go back to Compute > Instances. It should be running. Click on it, go to the Networking tab, and the "Attached VNICs". There will be one network there. Click on the three dots next to it, and click edit. It will show you the IPs, and there will be a radio menu on that page which asks if you want to assign a public IP. Select "Reserved Public IP", and select the newly created IP.

You can now access your machine! Now comes the fun stuff.
(More to be added)


5. I also had the idea that my friends should be able to see when I have the server down for maintenance or whatever, who are online, and all that via a simple web-interface, and additionally, what if I can direct that through that exact same link? This is where I am maybe going a little bit too crazy with technical ambition, but it was honestly easy enough to set-up. I ran a light Caddy on the Oracle server itself, whose entire job was to check "is this request on port 25565 or port 80/443", and then redirect it to the Minecraft server or the website. Easy, simple, works like a charm.
6. I hosted the actual website on my own server, cause why not? Updating the live data then becomes a matter of dealing with a local DB, and then pushing it to a Vercel frontend. I debated hosting on GitHub Pages, but it was more trouble than it was worth for essentially a single page website.

That's all! The code here will allow you to clone this repo, and run this exact stack. Obviously, you will need to bring your own Oracle account and set up the VPS on it. Googling is your friend, it is pretty self-explanatory, but I will add docs eventually.
