FROM node

ENV PULUMI_TAR=pulumi-v3.91.1-linux-x64.tar.gz
ENV PULUMI_CONFIG_PASSPHRASE=""
ENV PULUMI_SKIP_UPDATE_CHECK=true

RUN apt-get update && apt-get install -y vim nano less ncdu tmux \
	&& npm install -g pnpm \
	&& wget "https://get.pulumi.com/releases/sdk/$PULUMI_TAR" && tar -C /opt -xzf "$PULUMI_TAR" && rm "$PULUMI_TAR" && (cd /usr/local/bin && ln -s /opt/pulumi/pulumi) \
	&& pulumi login --local && useradd -ms /bin/bash proti && su proti -c 'pulumi login --local'

COPY --chown=proti:proti . /var/proti
RUN su proti -c 'cd /var/proti && yarn config set --home enableTelemetry 0 && yarn && yarn pack:all && cd examples && pnpm install'

WORKDIR /var/proti
USER proti
CMD bash
